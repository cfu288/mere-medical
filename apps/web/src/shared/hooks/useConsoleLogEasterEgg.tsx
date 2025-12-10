import Config from '../../environments/config.json';
import { useEffect } from 'react';

export function useConsoleLogEasterEgg() {
  useEffect(() => {
    if (!Config.PUBLIC_URL.includes('localhost')) {
      console.log(
        '%c Welcome to Mere!',
        'font-weight: bold;font-size: 30px;color: rgb(0, 97, 131);text-shadow:  1px 1px 0 rgb(141, 234, 255),  2px 2px 0 rgb(141, 234, 255),  3px 3px 0 rgb(121, 230, 255),  4px 4px 0 rgb(0, 197, 253),  5px 5px 0 rgb(0, 162, 213),  6px 6px 0 rgb(39, 209, 255),  7px 7px 0 rgb(35, 46, 80);margin-bottom: 4px;',
      );
      console.log(
        '%c If you like to tinker, check out our GitHub repo at https://github.com/cfu288/mere-medical',
        'font-size: 15px;color: rgb(0, 97, 131);text-shadow: 2px 2px 0 rgb(39, 209, 255); margin-bottom: 4px;',
      );
    }
    console.debug('Mere App Version: ', MERE_APP_VERSION);
  }, []);
}
