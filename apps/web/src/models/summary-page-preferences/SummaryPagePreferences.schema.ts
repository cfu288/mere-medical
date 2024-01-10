export const summaryPageSchemaLiteral = {
  title: 'Summary Page Preferences Schema',
  name: 'summary_page_preferences',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  description: 'Metadata used to describe the layout of the summary page',
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
    },
    user_id: {
      type: 'string',
      maxLength: 128,
      ref: 'user_documents',
    },
    pinned_labs: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 128,
        ref: 'clinical_documents',
      },
    },
    cards: {
      type: 'array',
      description:
        "If a user customizes the order of the cards, it's stored here.",
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: "The type of the card, e.g. 'medications'",
            maxLength: 128,
          },
          order: {
            type: 'number',
          },
          is_visible: {
            type: 'boolean',
          },
        },
      },
    },
  },
} as const;
