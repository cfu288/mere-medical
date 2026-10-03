declare module '@joplin/turndown-plugin-gfm' {
  import TurndownService from 'turndown';

  export const gfm: TurndownService.Plugin;
  export const tables: TurndownService.Plugin;
}
