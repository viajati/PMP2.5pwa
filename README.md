# Taiwan Pollution Tracker

A comprehensive mobile and web app for monitoring air pollution and weather conditions across Taiwan. Built with React Native/Expo for mobile and Next.js PWA for web, featuring real-time pollution data, interactive maps, AI-powered health advice, and user-friendly navigation.

## 🌟 Features

### Core Functionality
- **Real-time Pollution Monitoring**: Live PM2.5, PM10, and CO levels for all major Taiwanese cities
- **Interactive Maps**: Visualize pollution hotspots and plan routes with air quality considerations
- **Weather Integration**: Current weather conditions and forecasts for informed decision-making
- **AI Health Advice**: Personalized recommendations based on pollution levels, user profile, and health conditions
- **Route Planning**: Plan trips with pollution-aware routing and health impact assessments

### User Features
- **Multi-language Support**: English and Traditional Chinese interfaces
- **User Authentication**: Secure login with email/password and Google OAuth
- **Personal Profiles**: Health condition tracking for tailored advice
- **Activity Tracking**: Record daily routes and pollution exposure
- **Dark/Light Themes**: Comfortable viewing in any environment

### Technical Features
- **Cross-platform**: Native iOS/Android apps and web support
- **Offline-capable**: Cached data for offline viewing
- **Real-time Updates**: Live data from multiple weather and pollution APIs
- **Secure**: Encrypted API keys and secure authentication

## 🛠️ Tech Stack

### Mobile (React Native)
- **Framework**: React Native with Expo
- **Language**: JavaScript (ES6+)
- **State Management**: React Context API
- **Navigation**: React Navigation
- **Maps**: react-native-maps
- **Authentication**: Expo Auth Session (Google OAuth)
- **Storage**: AsyncStorage for local data

### Web (PWA)
- **Framework**: Next.js 15+
- **Language**: JavaScript (ES6+)
- **Styling**: CSS Modules, Tailwind CSS
- **State Management**: React Context API
- **Maps**: Interactive mapping components
- **Authentication**: Next.js Auth integration
- **Storage**: IndexedDB for offline capability

### Shared
- **APIs**: Open-Meteo, Google APIs
- **AI**: Google Gemini for health advice

## 📱 Screenshots

*(Add screenshots here when available)*

## 🚀 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- For mobile development: Xcode (iOS) or Android Studio (Android)

### Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/viajati/PMP2.5.git
   cd PMP2.5
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Copy `.env.example` to `.env` (if available) or create `.env`
   - Add your API keys:
     ```
     EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
     EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
     EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id
     ```

4. **Google OAuth Setup**
   - Create OAuth credentials in Google Cloud Console
   - Configure redirect URIs for web and mobile
   - Update client IDs in `.env`

### Running the App

#### Development
```bash
# Start Expo development server
npx expo start

# Run on specific platform
npx expo start --ios
npx expo start --android
npx expo start --web
```

#### Production Build
```bash
# Build for production
eas build --platform ios
eas build --platform android
```

## 📖 Usage

### First Time Setup
1. Launch the app
2. Create an account or sign in with Google
3. Complete your health profile for personalized advice
4. Grant location permissions for local weather data

### Main Features
- **Home Screen**: View current pollution levels and weather
- **Records Screen**: Browse historical data and route maps
- **Summary Screen**: View aggregated statistics
- **Settings**: Customize language, theme, and notifications

### Web Version
The web version provides full authentication and navigation testing, with map features available only on mobile platforms.

## 🔧 Configuration

### API Keys
- **Gemini API**: For AI health recommendations
- **Google OAuth**: For user authentication
- **Open-Meteo APIs**: For weather and pollution data (no keys required)

### Build Configuration
- Update `app.json` for app metadata
- Configure `eas.json` for build settings
- Set up push notifications in Expo dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

### Development Guidelines
- Follow React Native best practices
- Use TypeScript for new components (optional)
- Test on both iOS and Android
- Ensure web compatibility where possible

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Pollution data from Taiwan EPA and Open-Meteo
- Weather data from Open-Meteo
- Icons from Expo Vector Icons
- Maps powered by react-native-maps

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Check the [Expo Documentation](https://docs.expo.dev/)
- Review [React Native Docs](https://reactnative.dev/docs/getting-started)

---

**Note**: This app is for informational purposes only. Always consult local health authorities for air quality advisories.