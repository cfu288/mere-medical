import { Retrieved } from '../src/features/patient-context/agent/tools';

/** A read of any one of these sections of this reference. */
export type SectionRead = { reference: string; sections: string[] };

export const CATEGORIES = ['guideline', 'record'] as const;
export type Category = (typeof CATEGORIES)[number];

export type BenchCase = {
  id: string;
  /** Guideline cases answer from the library, record cases from the patient's record. */
  category: Category;
  question: string;
  /** Tools the agent must not call. */
  mustNotCall: string[];
  /** Each entry is satisfied by any one of its reads; the sections listed are every one that holds the answer. */
  mustRead: SectionRead[][];
  /** Patient data a tool result must have shown; each entry is satisfied by any one of its items. */
  mustRetrieve: Retrieved[][];
  /** Items worth opening that no requirement needs; opening them is not waste. */
  alsoRelevant: Retrieved[];
};

export const BENCH_CASES: BenchCase[] = [
  {
    id: 'uspstf-statin',
    category: 'guideline',
    question: 'When does the USPSTF recommend starting a statin?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'uspstf-statin-use-in-adults-preventive-medication',
          sections: [
            'recommendation-summary',
            'clinician-summary',
            'full-recommendation',
            'response-to-public-comment',
          ],
        },
        {
          reference: 'uspstf-a-and-b',
          sections: ['a-b-recommendations'],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'latest-cholesterol',
    category: 'record',
    question: 'What was my most recent cholesterol result?',
    mustNotCall: ['search_references', 'read_section'],
    mustRead: [],
    mustRetrieve: [
      [
        {
          kind: 'lab',
          analyte: '2093-3',
        },
        {
          kind: 'lab',
          analyte: '13457-7',
        },
      ],
    ],
    alsoRelevant: [],
  },
  {
    id: 'bp-at-goal',
    category: 'guideline',
    question: 'Is my blood pressure where it should be?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-hypertension',
          sections: [
            'ix-recommendations',
            'page-33-2',
            'page-34',
            'page-35',
            'module-b-treatment',
            'a-highlights-in-this-guideline-update',
            'appendix-b-evidence-table',
          ],
        },
      ],
    ],
    mustRetrieve: [
      [
        {
          kind: 'note',
          id: 'n1',
          part: 1,
        },
        {
          kind: 'note',
          id: 'n8',
          part: 1,
        },
      ],
    ],
    alsoRelevant: [],
  },
  {
    id: 'va-bp-goal',
    category: 'guideline',
    question:
      'According to the VA hypertension guideline, what blood pressure goal is recommended for adults with hypertension?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-hypertension',
          sections: [
            'ix-recommendations',
            'page-33-2',
            'page-34',
            'page-35',
            'module-b-treatment',
            'a-highlights-in-this-guideline-update',
            'appendix-b-evidence-table',
          ],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'va-a1c-target',
    category: 'guideline',
    question: 'What A1c target does the VA diabetes guideline recommend?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-type-2-diabetes',
          sections: [
            'page-25',
            'page-42',
            'page-45',
            'appendix-e-evidence-table',
            'appendix-i-alternative-text-descriptions-of-algorithm',
            'appendix-b-glycemic-control-targets-and-monitoring',
          ],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'vaccines-due',
    category: 'record',
    question: 'Am I due for any vaccines?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'cdc-adult-schedule-by-age',
          sections: ['ages-19-years-or-older'],
        },
        {
          reference: 'cdc-recommended-vaccinations-for-adults',
          sections: ['key', 'what-diseases-do-these-vaccines-protect-against'],
        },
        {
          reference: 'cdc-key-facts-about-seasonal-flu-vaccine',
          sections: ['who-should-be-vaccinated', 'what-to-know'],
        },
        {
          reference: 'cdc-tetanus-vaccination',
          sections: ['key-points', 'vaccine-recommendations'],
        },
      ],
    ],
    mustRetrieve: [
      [
        {
          kind: 'record',
          type: 'immunization',
          name: 'Influenza, Quadrivalent, Mdck, Preservative Free',
        },
        {
          kind: 'record',
          type: 'immunization',
          name: 'Influenza, split virus, trivalent, injectable, preservative free',
        },
      ],
      [
        {
          kind: 'record',
          type: 'immunization',
          name: 'Tdap',
        },
      ],
      [
        {
          kind: 'record',
          type: 'immunization',
          name: 'Moderna Covid-19 Mrna Vaccine Im Injection',
        },
      ],
    ],
    alsoRelevant: [],
  },
  {
    id: 'ckd-bp-medicines',
    category: 'guideline',
    question:
      'For someone with chronic kidney disease and high blood pressure, which blood pressure medicines do the guidelines recommend to protect the kidneys?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-ckd',
          sections: [
            'page-33',
            'page-53',
            'page-54',
            'page-56',
            'page-57',
            'page-58',
            'module-d-pharmacologic-management-of-ckd-in-patients-not-on-2',
            'appendix-h-management-of-ckd-table',
            'appendix-b-evidence-table',
          ],
        },
        {
          reference: 'va-dod-hypertension',
          sections: ['appendix-i-drug-and-dosage-table-selected-examples'],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'colon-screening-age',
    category: 'guideline',
    question: 'At what age should I start colon cancer screening?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'uspstf-colorectal-cancer-screening',
          sections: [
            'recommendation-summary',
            'clinician-summary',
            'full-recommendation',
            'starting-and-stopping-ages',
            'assessment-of-risk',
            'advising-black-adults',
            'other-related-uspstf-recommendations',
            'response-to-public-comments',
          ],
        },
        {
          reference: 'uspstf-a-and-b',
          sections: ['a-b-recommendations'],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'pertussis-treatment',
    category: 'guideline',
    question: 'My kid has pertussis. How is it treated?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'cdc-treatment-of-whooping-cough',
          sections: [
            'key-points',
            'treatment',
            'getting-treatment-in-a-hospital',
            'managing-symptoms-at-home',
          ],
        },
        {
          reference: 'cdc-treatment-of-pertussis',
          sections: [
            'key-points',
            'early-treatment-can-reduce-severity',
            'consider-treating-prior-to-test-results',
            'treatment-timeline',
            'antibiotic-choice',
            'important-considerations',
            'infants-less-than-1-month-of-age',
            'people-1-month-of-age-and-older',
            'people-2-months-of-age-and-older',
          ],
        },
        {
          reference: 'cdc-about-whooping-cough',
          sections: ['key-points', 'treatment-and-recovery'],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'measles-symptoms',
    category: 'guideline',
    question: 'What are the symptoms of measles?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'cdc-measles-symptoms-and-complications',
          sections: [
            '7-14-days-after-a-measles-infection-first-symptoms-show',
            '2-3-days-after-symptoms-begin-koplik-spots',
            '3-5-days-after-symptoms-begin-measles-rash',
          ],
        },
        {
          reference: 'cdc-about-measles',
          sections: ['signs-and-symptoms'],
        },
        {
          reference: 'cdc-recommended-vaccinations-for-adults',
          sections: ['what-diseases-do-these-vaccines-protect-against'],
        },
        {
          reference: 'cdc-recommended-vaccines-for-young-children',
          sections: ['what-diseases-do-these-vaccines-protect-against'],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'pneumococcal-from-record',
    category: 'record',
    question: 'Should I get the pneumococcal vaccine?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'cdc-pneumococcal-disease-in-adults-and-vaccines-to-pre',
          sections: ['recommendations', 'previously-vaccinated'],
        },
        {
          reference: 'cdc-pneumococcal-vaccination',
          sections: ['vaccine-recommendations'],
        },
        {
          reference: 'cdc-pneumococcal-disease-causes-and-how-it-spreads',
          sections: ['medical-conditions'],
        },
      ],
    ],
    mustRetrieve: [
      [
        {
          kind: 'record',
          type: 'immunization',
          name: 'Pneumococcal Conjugate PCV 13',
        },
      ],
    ],
    alsoRelevant: [],
  },
  {
    id: 'hb-bp-on-lisinopril',
    category: 'guideline',
    question:
      'over the last six months my blood pressure readings have been around 140 90 in the morning and 135 85 in the evening i take lisinopril 10 mg every morning i also changed my diet to keep sodium really low and boost potassium foods plus i do 30 minutes of exercise daily i record each reading the same time every day and keep a log do i add another medication or change my dose ask me questions if you need to give me next steps',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-hypertension',
          sections: [
            'ix-recommendations',
            'page-33-2',
            'page-34',
            'page-35',
            'module-b-treatment',
            'a-highlights-in-this-guideline-update',
            'appendix-b-evidence-table',
          ],
        },
      ],
    ],
    mustRetrieve: [],
    alsoRelevant: [],
  },
  {
    id: 'hep-b-nursing-school',
    category: 'guideline',
    question: 'Do I need a hepatitis B vaccine before nursing school?',
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'cdc-adult-schedule-by-age',
          sections: ['ages-19-years-or-older'],
        },
        {
          reference: 'cdc-recommended-vaccinations-for-adults',
          sections: ['what-diseases-do-these-vaccines-protect-against', 'key'],
        },
      ],
    ],
    mustRetrieve: [
      [
        {
          kind: 'record',
          type: 'immunization',
          name: 'Hep B, adult',
        },
        {
          kind: 'record',
          type: 'immunization',
          name: 'Hep B, Unspecified',
        },
        {
          kind: 'record',
          type: 'procedure',
          name: 'HEPB VACCINE 3 DOSE ADULT IM',
        },
      ],
      [
        {
          kind: 'lab',
          analyte: '16935-9',
        },
      ],
    ],
    alsoRelevant: [],
  },
  {
    id: 'metformin-dose-not-on-it',
    category: 'record',
    question: 'Is my metformin dose right?',
    mustNotCall: [],
    mustRead: [],
    mustRetrieve: [
      [
        {
          kind: 'record',
          type: 'medication',
          name: 'cholecalciferol 25 MCG (1000 UT) tablet',
        },
        {
          kind: 'record',
          type: 'medication',
          name: 'BENZONATATE 100 MG CAPSULE',
        },
        {
          kind: 'record',
          type: 'medication',
          name: 'valACYclovir 500 mg oral tablet',
        },
      ],
    ],
    alsoRelevant: [
      {
        kind: 'lab',
        analyte: '4548-4',
      },
      {
        kind: 'lab',
        analyte: '77147-7',
      },
    ],
  },
];
