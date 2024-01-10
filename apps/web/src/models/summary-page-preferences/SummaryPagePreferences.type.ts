export interface SummaryPagePreferences {
  id: string;
  user_id: string;
  pinned_labs?: string[];
  cards?: {
    type:
      | 'immunization'
      | 'allergyintolerance'
      | 'condition'
      | 'careplan'
      | 'medicationstatement';
    order: number;
    is_visible: boolean;
  }[];
}
