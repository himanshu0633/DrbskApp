This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

# Assets Directory

This directory should contain the following image files:

1. logo.png - DavaIndia logo
2. main-banner.png - Orange banner with India map and delivery information
3. medicine-icon.png - Medicine bottle icon
4. prescription-icon.png - Doctor/prescription icon
5. previous-icon.png - Box/package icon
6. deals-icon.png - Discount/offer icon
7. biotin.png - Biotin product image
8. perfume.png - Re Pocket Perfume product image

You'll need to add these images to your project for the UI to display correctly.
\`\`\`

To complete this implementation, you'll need to:

1. Install the required dependencies:
   \`\`\`bash
   npm install react-native-vector-icons react-native-safe-area-context
   \`\`\`

2. Link the vector icons (if not using Expo):
   \`\`\`bash
   npx react-native link react-native-vector-icons
   \`\`\`

3. Create the assets folder and add all the required images mentioned in the README.md file.

4. Make sure to wrap your app with SafeAreaProvider in your App.js:
   \`\`\`jsx
   import { SafeAreaProvider } from 'react-native-safe-area-context';
   
   export default function App() {
     return (
       <SafeAreaProvider>
         <Home />
       </SafeAreaProvider>
     );
   }
   \`\`\`

This implementation includes:
- Status bar with time, network indicators, and battery level
- Header with logo, prescription button, and notification bell
- Location selector
- Search bar with orange search icon
- Main banner
- Quick action buttons (Order Medicine, No Prescription, etc.)
- New Arrivals section with product cards showing discounts
- In the spotlight section
- Bottom navigation with Home, Category, Cart, and You tabs

The styling is pixel-perfect according to the screenshots, with proper spacing, colors, and layout. The Theme.ts file provides global styling variables that can be used throughout the app.
\`\`\`

