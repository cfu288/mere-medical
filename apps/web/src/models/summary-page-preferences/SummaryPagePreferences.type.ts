export interface SummaryPagePreferences {
  id: string;
  user_id: string;
  pinned_labs?: string[];
  cards?: SummaryPagePreferencesCard[];
}

export interface SummaryPagePreferencesCard {
  type:
    | 'immunizations'
    | 'allergies'
    | 'conditions'
    | 'careplans'
    | 'medications'
    | 'pinned';
  order: number;
  is_visible: boolean;
}
