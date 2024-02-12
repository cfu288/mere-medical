export const USPSTFRecommendationSchemaLiteral = {
  title: 'USPSTF Recommendation Schema',
  description: 'Represents suggested screenings from the USPSTF',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for the USPSTF recommendation',
      maxLength: 128,
    },
    topic: {
      type: 'string',
      description: 'The health topic related to the recommendation',
    },
    description: {
      type: 'string',
      description: 'A detailed description of the USPSTF recommendation',
    },
    url: {
      type: 'string',
      description: 'The URL to the USPSTF recommendation details',
    },
    recommendation: {
      type: 'string',
      description: 'The actual recommendation text to show to the user',
    },
    eligible: {
      type: 'boolean',
      description:
        'Indicates whether the individual is eligible for the recommendation',
    },
    lastModified: {
      type: 'string',
      description: 'The date and time the record was created',
    },
  },
} as const;
