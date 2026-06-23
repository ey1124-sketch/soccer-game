import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDUyXcQcOHsd18Z-4fwPrnKlfllzzBzDmQ",
  authDomain: "worldcup-4f0b0.firebaseapp.com",
  databaseURL: "https://worldcup-4f0b0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "worldcup-4f0b0",
  storageBucket: "worldcup-4f0b0.firebasestorage.app",
  messagingSenderId: "776419731327",
  appId: "1:776419731327:web:85dad498606d1c384b9c4a",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
