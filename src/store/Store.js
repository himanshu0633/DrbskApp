// store.js
import { configureStore } from "@reduxjs/toolkit";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistReducer, persistStore } from 'redux-persist';
import { combineReducers } from 'redux';

const initialState = {
  data: [],
};

const rootReducer = (state = initialState, action) => {
  switch (action.type) {
    case "ADD_DATA":
      return {
        ...state,
        data: [...state.data, action.payload],
      };
    case "DELETE_PRODUCT":
      return {
        ...state,
        data: state.data.filter((product) => product._id !== action.payload),
      };
    case "CLEAR_PRODUCT":
      return {
        ...state,
        data: action.payload,
      };
    case "CLEAR_ALLPRODUCT":
      return {
        ...state,
        data: [],
      };
    case "UPDATE_DATA":
      return {
        ...state,
        data: state.data.map((product) =>
          product._id === action.payload._id ? action.payload : product
        ),
      };
    default:
      return state;
  }
};

const root = combineReducers({
  app: rootReducer,
});

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
};

const persistedReducer = persistReducer(persistConfig, root);

const store = configureStore({
  reducer: persistedReducer,
});

const persistor = persistStore(store);

export { store, persistor };
