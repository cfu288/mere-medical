import { BrowserWindow, shell, screen } from 'electron';
import { rendererAppName, rendererAppPort } from './constants';
import { environment } from '../environments/environment';
import { join } from 'path';
import { format } from 'url';
import * as electron from 'electron';
import * as path from 'path';
import { concatPath } from './utils/urlUtils';

export default class App {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow: typeof BrowserWindow;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean =
      parseInt(process.env.ELECTRON_IS_DEV || '0', 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      App.application.quit();
    }
  }

  private static onClose() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    // @ts-ignore
    App.mainWindow = null;
  }

  private static onRedirect(event: any, url: string) {
    if (url !== App.mainWindow.webContents.getURL()) {
      // this is a normal external redirect, open it in a new browser window
      event.preventDefault();
      shell.openExternal(url);
    }
  }

  private static onReady() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    if (rendererAppName) {
      App.initMainWindow();
      App.loadMainWindow();

      // Handle the protocol. In this case, we choose to show an Error Box.
      App.application.on('open-url', (event: any, url: any) => {
        // trim out the protocol. redirect the app to the url
        const protocol = url.split('://')[0];
        const path = url.split('://')[1];
        if (protocol === 'mere') {
          if (!App.application.isPackaged) {
            App.mainWindow.loadURL(
              concatPath(`http://localhost:${rendererAppPort}`, `\//#/`, path),
            );
          } else {
            App.mainWindow.webContents.send('navigate', path);
          }
        } else {
          electron.dialog.showErrorBox(
            'Protocol Error',
            `Protocol "${protocol}" is not supported. Please contact your system administrator.`,
          );
        }
      });
    }
  }

  private static onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (App.mainWindow === null) {
      App.onReady();
    }
  }

  private static initMainWindow() {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.min(1280, workAreaSize.width || 1280);
    const height = Math.min(720, workAreaSize.height || 720);

    // Create the browser window.
    App.mainWindow = new BrowserWindow({
      width: width,
      height: height,
      show: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.js'),
      },
    });
    App.mainWindow.setMenu(null);
    App.mainWindow.center();

    // if main window is ready to show, close the splash window and show the main window
    App.mainWindow.once('ready-to-show', () => {
      App.mainWindow.show();
    });

    // handle all external redirects in a new browser window
    App.mainWindow.webContents.on('will-navigate', App.onRedirect);
    App.mainWindow.webContents.on(
      // @ts-ignore
      'new-window',
      (
        event: Electron.Event,
        url: string,
        frameName: string,
        disposition: string,
        options: Electron.BrowserWindowConstructorOptions,
      ) => {
        App.onRedirect(event, url);
      },
    );

    // Emitted when the window is closed.
    App.mainWindow.on('closed', () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      // @ts-ignore
      App.mainWindow = null;
    });

    // Set up local relative API calls to redirect to the remote API
    const session = App.mainWindow.webContents.session;
    session.webRequest.onBeforeRequest((details, callback) => {
      if (details.url.indexOf('file://api./') == 0) {
        //TODO Change to regex & parametrize (optional - set default value)
        //TODO Test it works with non-GET (should work - using 307 redirect)
        callback({
          redirectURL: `https://app.meremedical.co/${details.url.substr(12)}`,
        }); //TODO Parametrize (mandatory)
      } else {
        callback({}); //TODO Test this works
      }
    });

    // Handle custom protocol links
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        App.application.setAsDefaultProtocolClient('mere', process.execPath, [
          path.resolve(process.argv[1]),
        ]);
      }
    } else {
      App.application.setAsDefaultProtocolClient('mere');
    }
  }

  private static loadMainWindow() {
    // load the index.html of the app.
    if (!App.application.isPackaged) {
      App.mainWindow.loadURL(`http://localhost:${rendererAppPort}`);
    } else {
      App.mainWindow.loadURL(
        format({
          pathname: join(__dirname, '..', rendererAppName, 'index.html'),
          protocol: 'file:',
          slashes: true,
        }),
      );
    }
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow) {
    // we pass the Electron.App object and the
    // Electron.BrowserWindow into this function
    // so this class has no dependencies. This
    // makes the code easier to write tests for

    App.BrowserWindow = browserWindow;
    App.application = app;

    App.application.on('window-all-closed', App.onWindowAllClosed); // Quit when all windows are closed.
    App.application.on('ready', App.onReady); // App is ready to load data
    App.application.on('activate', App.onActivate); // App is activated
  }
}
