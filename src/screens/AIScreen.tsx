import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  Alert,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'react-native-image-picker';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  image?: string;
  timestamp: number;
  isFavorite?: boolean;
  imageAnalysis?: {
    tags: string[];
    description: string;
    confidence: number;
  };
}

interface ChatHistory {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  messages: Message[];
}

const AIScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [showImageAnalysis, setShowImageAnalysis] = useState(false);
  const [currentImageAnalysis, setCurrentImageAnalysis] = useState<Message['imageAnalysis']>();
  const [isHistoryTab, setIsHistoryTab] = useState(true);
  const [favorites, setFavorites] = useState<Message[]>([]);
  
  const flatListRef = useRef<FlatList>(null);

  const CHAT_HISTORY_KEY = '@chat_history';
  const FAVORITES_KEY = '@favorites';

  useEffect(() => {
    loadChatHistories();
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const favoritesString = await AsyncStorage.getItem(FAVORITES_KEY);
      if (favoritesString) {
        setFavorites(JSON.parse(favoritesString));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadChatHistories = async () => {
    try {
      const historiesString = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
      if (historiesString) {
        setChatHistories(JSON.parse(historiesString));
      }
    } catch (error) {
      console.error('Error loading chat histories:', error);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setInputText('');
    setSelectedImage(null);
  };

  const saveChatHistory = async () => {
    if (messages.length === 0) return;
    
    const newHistory: ChatHistory = {
      id: Date.now().toString(),
      title: messages[0].text.slice(0, 30) + '...',
      lastMessage: messages[messages.length - 1].text,
      timestamp: Date.now(),
      messages: messages
    };

    try {
      const updatedHistories = [newHistory, ...chatHistories].slice(0, 50);
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updatedHistories));
      setChatHistories(updatedHistories);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const toggleFavorite = async (messageId: string) => {
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, isFavorite: !msg.isFavorite };
      }
      return msg;
    });
    
    setMessages(updatedMessages);
    
    try {
      const newFavorites = updatedMessages.filter(msg => msg.isFavorite);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const processImageWithGemini = async (base64Image: string) => {
    try {
      const modelWithImage = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
      
      const prompt = `Bu görseli analiz et ve şunları sağla:
      1. Detaylı bir açıklama
      2. Önemli görsel öğeler ve nesneler
      3. Dikkat çeken desenler veya özellikler
      4. Analiz güven seviyesi (yüzde olarak)`;
      
      const result = await modelWithImage.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg"
          }
        }
      ]);
  
      const response = await result.response;
      const analysisText = response.text();
      
      const analysis = {
        description: analysisText.split('\n')[0],
        tags: extractTags(analysisText),
        confidence: extractConfidence(analysisText)
      };
      
      return {
        text: analysisText,
        analysis
      };
    } catch (error) {
      console.error('Image processing error:', error);
      throw error;
    }
  };

  const extractTags = (text: string): string[] => {
    const words = text.toLowerCase().split(/\W+/);
    return Array.from(new Set(words.filter(w => w.length > 3))).slice(0, 5);
  };

  const extractConfidence = (text: string): number => {
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 85;
  };

  const selectImage = () => {
    ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
    }, async (response) => {
      if (response.assets && response.assets[0].base64) {
        const base64Image = response.assets[0].base64;
        setSelectedImage(`data:image/jpeg;base64,${base64Image}`);
        
        try {
          const { text, analysis } = await processImageWithGemini(base64Image);
          
          const newMessage: Message = {
            id: Date.now().toString(),
            text: text,
            isUser: false,
            image: `data:image/jpeg;base64,${base64Image}`,
            timestamp: Date.now(),
            imageAnalysis: analysis
          };
          
          setMessages(prev => [...prev, newMessage]);
          setCurrentImageAnalysis(analysis);
          setShowImageAnalysis(true);
        } catch (error) {
          Alert.alert('Hata', 'Görsel analizi yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
        }
      }
    });
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    setIsLoading(true);
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: Date.now(),
      image: selectedImage || undefined,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setSelectedImage(null);

    try {
      const result = await model.generateContent(inputText);
      const response = await result.response;
      const text = response.text();
      
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: text,
        isUser: false,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, botResponse]);
      saveChatHistory();
    } catch (error) {
      Alert.alert('Hata', 'Yanıt alınırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const MessageItem = ({ message }: { message: Message }) => (
    <View style={[
      styles.messageContainer,
      message.isUser ? styles.userMessage : styles.botMessage
    ]}>
      <Text style={[
        styles.messageText,
        message.isUser ? styles.userMessageText : styles.botMessageText
      ]}>{message.text}</Text>
      
      {message.image && (
        <TouchableOpacity 
          onPress={() => {
            setCurrentImageAnalysis(message.imageAnalysis);
            setShowImageAnalysis(true);
          }}
        >
          <Image 
            source={{ uri: message.image }}
            style={styles.messageImage}
          />
        </TouchableOpacity>
      )}
      
      <View style={styles.messageFooter}>
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleString('tr-TR')}
        </Text>
        {!message.isUser && (
          <TouchableOpacity onPress={() => toggleFavorite(message.id)}>
            <Text style={styles.favoriteIcon}>{message.isFavorite ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const NewChatButton = () => (
    <TouchableOpacity 
      style={styles.newChatButton}
      onPress={startNewChat}
    >
      <Text style={styles.newChatButtonText}>+</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <NewChatButton />
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageItem message={item} />}
        keyExtractor={item => item.id}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        contentContainerStyle={styles.messagesList}
      />
      
      <View style={styles.inputContainer}>
        {selectedImage && (
          <View style={styles.selectedImageContainer}>
            <Image 
              source={{ uri: selectedImage }}
              style={styles.selectedImage}
            />
            <TouchableOpacity 
              onPress={() => setSelectedImage(null)}
              style={styles.removeImageButton}
            >
              <Text style={styles.removeImageText}>X</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputRow}>
          <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.button}>
            <Text>📚</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={selectImage} style={styles.button}>
            <Text>📷</Text>
          </TouchableOpacity>
          
          <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Mesajınızı yazın..."
              multiline
              autoCorrect={false}
              keyboardType="default"
              textContentType="none"
              autoCapitalize="none"
          />
          
          <TouchableOpacity 
            onPress={sendMessage}
            style={[styles.button, (!inputText.trim() && !selectedImage) && styles.buttonDisabled]}
            disabled={!inputText.trim() && !selectedImage || isLoading}
          >
            <Text>{isLoading ? '⏳' : '📤'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.tabContainer}>
                <TouchableOpacity 
                  style={[styles.tab, isHistoryTab && styles.activeTab]}
                  onPress={() => setIsHistoryTab(true)}
                >
                  <Text style={[styles.tabText, isHistoryTab && styles.activeTabText]}>Geçmiş</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, !isHistoryTab && styles.activeTab]}
                  onPress={() => setIsHistoryTab(false)}
                >
                  <Text style={[styles.tabText, !isHistoryTab && styles.activeTabText]}>Favoriler</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {isHistoryTab ? (
                chatHistories.map(history => (
                  <TouchableOpacity
                    key={history.id}
                    style={styles.historyItem}
                    onPress={() => {
                      setMessages(history.messages);
                      setShowHistory(false);
                    }}
                  >
                    <Text style={styles.historyTitle}>{history.title}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(history.timestamp).toLocaleString('tr-TR')}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                favorites.map(favorite => (
                  <View key={favorite.id} style={styles.favoriteItem}>
                    <Text style={styles.favoriteText}>{favorite.text}</Text>
                    <Text style={styles.favoriteDate}>
                      {new Date(favorite.timestamp).toLocaleString('tr-TR')}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImageAnalysis}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowImageAnalysis(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Görsel Analizi</Text>
              <TouchableOpacity onPress={() => setShowImageAnalysis(false)}>
                <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
            </View>
            
            {currentImageAnalysis && (
              <ScrollView style={styles.analysisContent}>
                <Text style={styles.analysisTitle}>Açıklama:</Text>
                <Text style={styles.analysisText}>{currentImageAnalysis.description}</Text>
                
                <Text style={styles.analysisTitle}>Etiketler:</Text>
                <View style={styles.tagsContainer}>
                  {currentImageAnalysis.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                
                <Text style={styles.analysisTitle}>Güven Seviyesi:</Text>
                <Text style={styles.analysisText}>{currentImageAnalysis.confidence}%</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesList: {
    padding: 10,
    paddingBottom: 60,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 15,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#000000',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 5,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  favoriteIcon: {
    fontSize: 20,
  },
  inputContainer: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    marginHorizontal: 10,
    padding: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    maxHeight: 100,
  },
  button: {
    padding: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  selectedImageContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  newChatButton: {
    position: 'absolute',
    right: 20,
    bottom: 80, 
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  newChatButtonText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    padding: 2,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 18,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  historyItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  historyTitle: {
    fontSize: 16,
    marginBottom: 5,
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
  },
  favoriteItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  favoriteText: {
    fontSize: 16,
    marginBottom: 5,
  },
  favoriteDate: {
    fontSize: 12,
    color: '#666',
  },
  analysisContent: {
    padding: 10,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  tag: {
    backgroundColor: '#E5E5E5',
    borderRadius: 15,
    padding: 8,
    margin: 5,
  },
  tagText: {
    fontSize: 12,
    color: '#333',
  },
});

export default AIScreen;
