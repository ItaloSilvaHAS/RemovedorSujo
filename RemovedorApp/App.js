import React, { useState } from 'react';
import { Button, Image, View, ActivityIndicator, Alert, StyleSheet, Text, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mantenha seu IP atualizado aqui
  const SERVER_URL = 'http://192.168.0.6:5000/remove-bg';

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Erro", "Precisamos de permissão para acessar suas fotos.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10, // LIMITE DE 10 IMAGENS!
      quality: 1,
    });

    if (!result.canceled) {
      processQueue(result.assets);
    }
  };

  const processQueue = async (assets) => {
    setLoading(true);
    setImages([]); 
    const processed = [];

    for (const asset of assets) {
      try {
        const formData = new FormData();
        formData.append('image', { 
          uri: asset.uri, 
          name: 'input_image.jpg', 
          type: 'image/jpeg' 
        });

        const response = await fetch(SERVER_URL, { 
          method: 'POST', 
          body: formData 
        });

        if (response.status === 200) {
          const blob = await response.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
          });
          processed.push(base64);
        } else {
          console.log("Erro no servidor ao processar uma imagem.");
        }
      } catch (e) {
        console.log("Erro de conexão:", e);
      }
    }

    setImages(processed);
    setLoading(false);
    if (processed.length > 0) {
      Alert.alert("Sucesso!", `${processed.length} imagens processadas no padrão ML!`);
    }
  };

  const shareImage = async (imgBase64) => {
    try {
      const cacheDir = FileSystemLegacy.cacheDirectory;
      const filename = `${cacheDir}PRODUTO_ML_${Date.now()}.jpg`;
      const base64Data = imgBase64.split('base64,')[1];
      
      await FileSystemLegacy.writeAsStringAsync(filename, base64Data, {
        encoding: 'base64', 
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename);
      }
    } catch (e) {
      console.log("Erro ao compartilhar:", e);
      Alert.alert("Erro", "Não foi possível compartilhar a imagem.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ML Photo Express</Text>
      
      <View style={styles.mainButton}>
        <Button title="Selecionar até 10 Fotos" onPress={pickImages} color="#2196F3" />
      </View>

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FFE600" />
          <Text style={styles.loadingText}>Sua IA está criando o fundo branco...</Text>
        </View>
      )}

      {images.map((img, index) => (
        <View key={index} style={styles.card}>
          <Image source={{ uri: img }} style={styles.image} />
          <View style={styles.cardActions}>
             <Button title="Baixar / Compartilhar" onPress={() => shareImage(img)} color="#4CAF50" />
          </View>
        </View>
      ))}

      {images.length > 0 && (
        <View style={styles.footer}>
          <Button title="Limpar Tudo" onPress={() => setImages([])} color="#f44336" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    backgroundColor: '#FFE600', // Amarelo Mercado Livre
    alignItems: 'center', 
    paddingVertical: 40 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    color: '#333' 
  },
  mainButton: { 
    width: '90%', 
    marginBottom: 30 
  },
  loader: { 
    marginVertical: 20, 
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 20,
    borderRadius: 15
  },
  loadingText: {
    marginTop: 10,
    fontWeight: 'bold',
    color: '#333'
  },
  card: { 
    backgroundColor: '#fff', 
    padding: 10, 
    borderRadius: 15, 
    marginBottom: 25, 
    alignItems: 'center', 
    width: '90%',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  image: { 
    width: 300, 
    height: 300, 
    resizeMode: 'contain', 
    backgroundColor: '#fff' // Garante fundo branco visual
  },
  cardActions: {
    marginTop: 15,
    width: '100%'
  },
  footer: {
    width: '90%',
    marginBottom: 40
  }
});