# Taiwan Pollution Tracker - PWA

A Progressive Web App (PWA) built with [Next.js](https://nextjs.org) for monitoring air pollution and weather conditions across Taiwan. This is the web platform of the Taiwan Pollution Tracker project, providing real-time pollution data, interactive maps, and AI-powered health advice accessible from any browser.

## 🌟 Features

- **Real-time Pollution Monitoring**: Live PM2.5, PM10, and CO levels for all major Taiwanese cities
- **Interactive Maps**: Visualize pollution hotspots with dynamic mapping
- **Weather Integration**: Current weather conditions and forecasts
- **AI Health Advice**: Personalized recommendations based on pollution levels
- **Route Planning**: Plan trips with pollution-aware routing
- **Offline Capable**: Works offline with cached data using IndexedDB
- **Responsive Design**: Optimized for desktop, tablet, and mobile browsers
- **User Authentication**: Secure login and profile management
- **Dark/Light Theme**: Comfortable viewing in any environment

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Git

### Installation & Development

1. **Clone and navigate to the PWA directory**
   ```bash
   git clone https://github.com/viajati/PMP2.5pwa.git
   cd PMP2.5pwa/pmp25-pwa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the `pmp25-pwa` directory:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
pmp25-pwa/
├── app/               # Next.js app directory with pages
│   ├── page.js       # Landing page
│   ├── login/        # Login page
│   ├── home/         # Home dashboard
│   ├── profile/      # User profile
│   ├── records/      # Activity records
│   ├── setup/        # Initial setup
│   └── summary/      # Summary statistics
├── components/        # Reusable React components
├── lib/              # Utility functions and helpers
├── public/           # Static assets
└── styles/           # Global and module styles
```

## 🛠️ Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📱 PWA Capabilities

- **Installable**: Install as a standalone app on supported devices
- **Offline Support**: Service workers enable offline functionality
- **Fast Loading**: Optimized performance with Next.js
- **Cross-browser**: Works on all modern browsers

## 🌐 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms
The app can be deployed to any platform that supports Node.js applications.

## 🔗 Related Projects

- **Mobile App**: See the parent directory for React Native/Expo mobile app
- **Main Repository**: https://github.com/viajati/PMP2.5pwa.git

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Progressive Web Apps](https://web.dev/progressive-web-apps/)
- [React Documentation](https://react.dev)

## 📝 License

Part of the Taiwan Pollution Tracker project.
