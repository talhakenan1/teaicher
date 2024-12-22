import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const OneToOneScreen = () => {
  return (
    <View style={styles.container}>
      <Text>1-1 Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OneToOneScreen;