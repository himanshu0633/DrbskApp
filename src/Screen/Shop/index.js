import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import axiosInstance from '../../Components/AxiosInstance';
import { useNavigation } from '@react-navigation/native';
import API_URL from '../../../config';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useRoute } from '@react-navigation/native';



const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#f26522',
  primaryLight: '#ff8a50',
  primaryDark: '#c53d00',
  secondary: '#2e7d32',
  secondaryLight: '#60ad5e',
  secondaryDark: '#005005',
  background: '#f8f9fa',
  white: '#ffffff',
  black: '#000000',
  gray: '#757575',
  lightGray: '#e0e0e0',
  textPrimary: '#212121',
  textSecondary: '#757575',
};

const Shop = () => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const navigation = useNavigation();
  const route = useRoute();



useFocusEffect(
  useCallback(() => {
    const loadData = async () => {
      try {
        const catRes = await axiosInstance.get('/user/allcategories');
        const cats = catRes?.data || [];
        setCategories(cats);

        const subRes = await axiosInstance.get('/user/allSubcategories');
        const subs = subRes?.data || [];
        setSubcategories(subs);

        // Handle pre-selected category from route params
        const incomingCategory = route.params?.selectedCategory;
        if (incomingCategory) {
          setSelectedCategoryId(incomingCategory._id);
        }

        console.log('Categories:', cats);
        console.log('Subcategories:', subs);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [route.params?.selectedCategory]) 
);

  

  const filteredSubcategories = subcategories.filter(
    (sub) => sub?.category_id?._id === selectedCategoryId
  );

 const renderCategoryItem = ({ item }) => (
  <TouchableOpacity
    style={[
      styles.categoryItem,
      item._id === selectedCategoryId && styles.categoryItemSelected,
    ]}
    onPress={() => setSelectedCategoryId(item._id)}
  >
    <Image
      source={{ uri: `${API_URL}/${item.image}` }}
      style={styles.categoryImage}
    />
    <Text
      style={[
        styles.categoryText,
        item._id === selectedCategoryId && styles.categoryTextSelected,
      ]}
    >
      {item.name}
    </Text>
  </TouchableOpacity>
);


  const renderSubCategoryItem = ({ item }) => (
    <TouchableOpacity
    style={styles.subcategoryBox}
    onPress={() =>
      navigation.navigate('ProductsPage', {
        subcategoryId: item._id,
        subcategoryName: item.name,
      })
    }
  >
      <Image source={{ uri: `${API_URL}/${item?.image}` }}  style={styles.subcategoryImage} />
      <Text style={styles.subcategoryText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.header}>
        <Image
          source={{ uri: 'https://v0.blob.com/logo_placeholder.png' }}
          style={styles.logo}
        />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.leftPane}>
          <FlatList
            data={categories}
            keyExtractor={(item) => item._id.toString()}
            renderItem={renderCategoryItem}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.rightPane}>
          {selectedCategoryId ? (
            <FlatList
              data={filteredSubcategories}
              keyExtractor={(item) => item._id.toString()}
              renderItem={renderSubCategoryItem}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.noDataText}>No subcategories</Text>
              }
            />
          ) : (
            <Text style={styles.noDataText}>
              Please select a category to view subcategories.
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  logo: {
    width: 140,
    height: 40,
    resizeMode: 'contain',
  },
  contentContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  leftPane: {
    width: width * 0.25,
    backgroundColor: COLORS.white,
    borderRightWidth: 1,
    borderRightColor: COLORS.lightGray,
  },
  rightPane: {
    flex: 1,
    padding: 12,
  },

  categoryImage: {
  width: 40,
  height: 40,
  marginBottom: 5,
  borderRadius: 2,
  alignSelf: 'center',
  resizeMode: 'contain',
},

  categoryItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  categoryItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  categoryTextSelected: {
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subcategoryBox: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginBottom: 15,
    padding: 10,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  subcategoryImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  subcategoryText: {
    fontSize: 12,
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  noDataText: {
    textAlign: 'center',
    color: COLORS.gray,
    marginTop: 20,
  },
});

export default Shop;
