import React, { useEffect, useState, useCallback } from 'react';
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
  TextInput,
  Animated,
  ScrollView,
} from 'react-native';
import axiosInstance from '../../Components/AxiosInstance';
import { useNavigation } from '@react-navigation/native';
import API_URL from '../../../config';
import { useFocusEffect } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Search, ShoppingBag, ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
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
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredCategories, setFilteredCategories] = useState([]);
  const navigation = useNavigation();
  const route = useRoute();
   const cartItems = useSelector((state) => state?.app?.data || []);  
  const cartCount = cartItems.length;
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const catRes = await axiosInstance.get('/user/allcategories');
          const cats = catRes?.data || [];
          setCategories(cats);
          setFilteredCategories(cats);

          const subRes = await axiosInstance.get('/user/allSubcategories');
          const subs = subRes?.data || [];
          setSubcategories(subs);

          // Handle pre-selected category from route params
          const incomingCategory = route.params?.selectedCategory;
          if (incomingCategory) {
            setSelectedCategoryId(incomingCategory._id);
          }
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };

      loadData();
    }, [route.params?.selectedCategory])
  );

  // Filter categories based on search
  useEffect(() => {
    if (searchText.trim()) {
      const filtered = categories.filter(category =>
        category.name.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  }, [searchText, categories]);

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
        numberOfLines={2}
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
      <Image
        source={{ uri: `${API_URL}/${item?.image}` }}
        style={styles.subcategoryImage}
      />
      <Text style={styles.subcategoryText} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header Section */}
      <View style={styles.header}>
        {searchActive ? (
          <View style={styles.searchHeader}>
            <TouchableOpacity
              onPress={() => {
                setSearchActive(false);
                setSearchText('');
              }}
              style={styles.searchBackButton}
            >
              <ArrowLeft size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.searchInputContainer}>
              <Search size={20} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search categories..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Text style={styles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.normalHeader}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Categories</Text>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setSearchActive(true)}
              >
                <Search size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, styles.cartButton]}
                onPress={() => navigation.navigate('Cart')}
              >
                <ShoppingBag size={22} color={COLORS.textPrimary} />
                 {cartCount > 0 && (
                                      <View style={styles.cartBadge}>
                                        <Text style={styles.cartBadgeText}>
                                          {cartCount > 9 ? '9+' : cartCount}
                                        </Text>
                                      </View>
                                    )}
                {/* You can add cart badge here if needed */}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.leftPane}>
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item._id.toString()}
            renderItem={renderCategoryItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.noDataText}>No categories found</Text>
            }
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
                <Text style={styles.noDataText}>No subcategories found</Text>
              }
            />
          ) : (
            <View style={styles.noSelectionContainer}>
              <ShoppingBag size={60} color={COLORS.lightGray} />
              <Text style={styles.noSelectionText}>
                Please select a category to view subcategories
              </Text>
            </View>
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
  
  // Header Styles
  header: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  
  normalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  
  cartButton: {
    position: 'relative',
  },
  
  // Search Header Styles
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  
  searchBackButton: {
    padding: 8,
    marginRight: 8,
  },
  
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  
  clearText: {
    fontSize: 18,
    color: COLORS.gray,
    fontWeight: 'bold',
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
  
  categoryItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    alignItems: 'center',
  },
  
  categoryItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  
  categoryImage: {
    width: 50,
    height: 40,
    marginBottom: 8,
    borderRadius: 4,
    resizeMode: 'cover',
  },
  
  categoryText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  categoryTextSelected: {
    fontWeight: 'bold',
    color: COLORS.white,
  },
  
  subcategoryBox: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 15,
    padding: 12,
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
    marginBottom: 10,
    resizeMode: 'cover',
  },
  
  subcategoryText: {
    fontSize: 13,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  
  noDataText: {
    textAlign: 'center',
    color: COLORS.gray,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  
  noSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  noSelectionText: {
    textAlign: 'center',
    color: COLORS.gray,
    marginTop: 16,
    fontSize: 16,
    paddingHorizontal: 20,
  },
    cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default Shop;