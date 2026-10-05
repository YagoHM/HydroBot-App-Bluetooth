# HydroBot — aplicativo de controle

Aplicativo Expo/React Native para controlar o HydroBot por **Bluetooth Low Energy (BLE)** (`react-native-ble-plx`), com **Modo de Simulação** para testar a interface sem o robô.

- Android (BLE real): `npx expo run:android`. Requer development build; o Expo Go comum não inclui o módulo BLE.
- Web (somente simulação): `npx expo start --web`. O transporte BLE fica em `services/bleTransport.ts`, e a versão web (`bleTransport.web.ts`) não carrega o módulo nativo.
- Testes de lógica (simulador e validação): `npm test`.
- Ajustes de IHC da 3ª entrega, verificação e limitações: [docs/IHC-V3-ajustes.md](docs/IHC-V3-ajustes.md).

---

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
