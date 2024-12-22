import React from 'react';
import { NavigationContainer, CompositeNavigationProp } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AIScreen from './src/screens/AIScreen';
import RankScreen from './src/screens/RankScreen';
import OneToOneScreen from './src/screens/OneToOneScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Tip tanımlamaları
type RootDrawerParamList = {
  MainApp: undefined;
};

type TabParamList = {
  AI: undefined;
  Rank: undefined;
  '1-1': undefined;
};

type CompositeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  DrawerNavigationProp<RootDrawerParamList>
>;

type ProfileButtonProps = {
  navigation: DrawerNavigationProp<RootDrawerParamList>;
};

// Drawer ve Tab Navigator'ları oluştur
const Drawer = createDrawerNavigator<RootDrawerParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Geçici ekran bileşenleri
// const AIScreen = () => <View style={styles.center}><Text>AI Screen</Text></View>;
// const RankScreen = () => <View style={styles.center}><Text>Rank Screen</Text></View>;
// const OneToOneScreen = () => <View style={styles.center}><Text>1-1 Screen</Text></View>;
// const ProfileScreen: React.FC = () => <View style={styles.center}><Text>Profile Screen</Text></View>;

// Logo bileşeni
const AppLogo: React.FC = () => (
  <View style={styles.logoContainer}>
    <Image
      source={require('./assets/logo.png')}
      style={styles.logo}
    />
  </View>
);

// Profil butonu bileşeni
const ProfileButton: React.FC<ProfileButtonProps> = ({ navigation }) => (
  <TouchableOpacity 
    style={styles.profileButton}
    onPress={() => navigation.openDrawer()}>
    <Image
      source={require('./assets/profile.png')}
      style={styles.profileImage}
    />
  </TouchableOpacity>
);

// Tab Navigator bileşeni
const TabNavigator = () => {
  return (
    <Tab.Navigator 
  screenOptions={({ navigation }) => ({
    tabBarStyle: styles.tabBar,
    tabBarActiveTintColor: '#007AFF',
    tabBarInactiveTintColor: '#8E8E93',
    headerStyle: styles.header,
    headerTitleStyle: styles.headerTitle,
    headerLeft: () => <AppLogo />,
    headerRight: () => <ProfileButton navigation={navigation.getParent<DrawerNavigationProp<RootDrawerParamList>>()!} />,
    // Tab bar ikonları ve etiketleri
    tabBarLabelStyle: {
      fontSize: 12,
      marginBottom: 5,
    },
  })}>
  <Tab.Screen 
    name="AI" 
    component={AIScreen}
    options={{
      tabBarIcon: ({ color }) => (
        <Text style={{color, fontSize: 20}}>🤖</Text>
      ),
    }}
  />
  <Tab.Screen 
    name="Rank" 
    component={RankScreen}
    options={{
      tabBarIcon: ({ color }) => (
        <Text style={{color, fontSize: 20}}>🏆</Text>
      ),
    }}
  />
  <Tab.Screen 
    name="1-1" 
    component={OneToOneScreen}
    options={{
      tabBarIcon: ({ color }) => (
        <Text style={{color, fontSize: 20}}>👥</Text>
      ),
    }}
  />
</Tab.Navigator>
  );
};

// Ana uygulama bileşeni
const App: React.FC = () => {
  return (
    <NavigationContainer>
      <Drawer.Navigator
        screenOptions={{
          drawerPosition: 'right',
          drawerStyle: styles.drawer,
        }}>
        <Drawer.Screen 
          name="MainApp" 
          component={TabNavigator}
          options={{ headerShown: false }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
};

// Stiller
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    display: 'none',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    height: 60,
    paddingBottom: 5,
  },
  drawer: {
    width: '80%',
  },
  logoContainer: {
    paddingLeft: 15,
  },
  logo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  profileButton: {
    marginRight: 15,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
});

export default App;