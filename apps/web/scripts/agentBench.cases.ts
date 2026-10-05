/** A read of this reference; when sections are listed, a read of one of them. */
export type SectionRead = { reference: string; sections?: string[] };

export const CATEGORIES = ['drug-label', 'guideline', 'record'] as const;
export type Category = (typeof CATEGORIES)[number];

export type BenchCase = {
  id: string;
  /** drug-label and guideline cases answer from the library, record cases from the patient's record. */
  category: Category;
  question: string;
  /** Tools the agent must call at least once. */
  mustCall: string[];
  /** Tools the agent must not call. */
  mustNotCall: string[];
  /** Each entry is satisfied by any one of its reads; sections listed are the ones that hold the answer. */
  mustRead: SectionRead[][];
  /** References the agent must not read. */
  mustNotRead: string[];
};

const APIXABAN_AF_DOSING = [
  'oral-reduction-of-risk-of-stroke-and-systemic-embolism-in-patient',
  'oral-reduction-of-risk-of-stroke-and-systemic-embolism-in-patient-2',
];

export const BENCH_CASES: BenchCase[] = [
  {
    id: 'eliquis-dose-reduction',
    category: 'drug-label',
    question:
      'I take Eliquis for atrial fibrillation. When would my dose need to be lowered, and to what dose?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [[{ reference: 'label-apixaban', sections: APIXABAN_AF_DOSING }]],
    mustNotRead: [],
  },
  {
    id: 'eliquis-misspelled',
    category: 'drug-label',
    question: 'What is the usual Eliquiss dose for atrial fibrillation?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-apixaban',
          sections: ['oral-dosage-and-administration', ...APIXABAN_AF_DOSING],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'eliquis-dialysis',
    category: 'drug-label',
    question: 'I am on dialysis. Does that change my Eliquis dose?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-apixaban',
          sections: ['oral-patients-with-end-stage-renal-disease-on-dialysis'],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'eliquis-cyp3a4-inducer',
    category: 'drug-label',
    question:
      'Is carbamazepine a CYP3A4 inducer, and can I take it with my Eliquis?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-apixaban',
          sections: [
            'oral-7-2-combined-p-gp-and-strong-cyp3a4-inducers',
            'oral-drug-interactions',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'eliquis-for-someone-else',
    category: 'drug-label',
    question: 'What dose of Eliquis should I give my 85-year-old mother?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [[{ reference: 'label-apixaban', sections: APIXABAN_AF_DOSING }]],
    mustNotRead: [],
  },
  {
    id: 'metoprolol-two-forms',
    category: 'drug-label',
    question: 'How is Lopressor taken compared with Toprol XL?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-metoprolol-tartrate',
          sections: [
            'oral-dosage-and-administration',
            'oral-2-1-hypertension',
            'oral-2-2-angina-pectoris',
          ],
        },
      ],
      [
        {
          reference: 'label-metoprolol-succinate',
          sections: [
            'oral-dosage-and-administration',
            'oral-2-1-hypertension',
            'oral-2-2-angina-pectoris',
            'oral-2-4-administration',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'atorvastatin-clarithromycin',
    category: 'drug-label',
    question:
      'I take atorvastatin and my doctor wants to start clarithromycin. Is there a limit on my atorvastatin dose?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-atorvastatin-calcium',
          sections: [
            'oral-2-5-dosage-modifications-due-to-drug-interactions',
            'oral-select-azole-antifungals-or-macrolide-antibiotics',
            'oral-7-1-drug-interactions-that-may-increase-the-risk-of-myopathy',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'simvastatin-amlodipine',
    category: 'drug-label',
    question:
      'I take Zocor and Norvasc together. What is the most Zocor I can take?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-simvastatin',
          sections: [
            'oral-2-5-dosage-modifications-due-to-drug-interactions',
            'oral-7-1-drug-interactions-that-increase-the-risk-of-myopathy-and',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'metformin-kidney-function',
    category: 'drug-label',
    question:
      'At what kidney function should metformin not be started, or not be used at all?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-metformin-hydrochloride',
          sections: [
            'oral-2-2-recommendations-for-use-in-renal-impairment',
            'oral-4-contraindications',
            'oral-8-6-renal-impairment',
            'oral-dosage-and-administration',
            'oral-contraindications',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'clopidogrel-omeprazole',
    category: 'drug-label',
    question: 'Can I take Prilosec with my Plavix?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-clopidogrel-bisulfate',
          sections: [
            'oral-7-2cyp2c19-inhibitors',
            'oral-5-1-diminished-antiplatelet-activity-in-patients-with-impair',
            'oral-17-patient-counseling-information',
            'oral-warnings-and-precautions',
          ],
        },
        {
          reference: 'label-omeprazole',
          sections: [
            'oral-5-7-interaction-with-clopidogrel',
            'oral-7-drug-interactions',
            'oral-17-patient-counseling-information',
            'oral-warnings-and-precautions',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'sertraline-sumatriptan',
    category: 'drug-label',
    question: 'Is it safe to take Imitrex while I am on Zoloft?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-sertraline-hydrochloride',
          sections: [
            'oral-5-2-serotonin-syndrome',
            'oral-7-1-clinically-significant-drug-interactions',
            'oral-17-patient-counseling-information',
          ],
        },
        {
          reference: 'label-sumatriptan-succinate',
          sections: [
            'oral-5-7-serotonin-syndrome',
            'oral-7-4-selective-serotonin-reuptake-inhibitors-serotonin-norepi',
            'oral-17-patient-counseling-information',
            'oral-warnings-and-precautions',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'warfarin-pregnancy',
    category: 'drug-label',
    question: 'Can warfarin be used during pregnancy?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-warfarin-sodium',
          sections: [
            'oral-4-contraindications',
            'oral-5-7-use-in-pregnant-women-with-mechanical-heart-valves',
            'oral-8-1-pregnancy',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'uspstf-statin',
    category: 'guideline',
    question: 'When does the USPSTF recommend starting a statin?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'uspstf-statin-use-in-adults-preventive-medication',
          sections: [
            'recommendation-summary',
            'clinician-summary',
            'full-recommendation',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'latest-cholesterol',
    category: 'record',
    question: 'What was my most recent cholesterol result?',
    mustCall: ['search_labs'],
    mustNotCall: ['search_references', 'read_section'],
    mustRead: [],
    mustNotRead: [],
  },
  {
    id: 'bp-at-goal',
    category: 'guideline',
    question: 'Is my blood pressure where it should be?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-hypertension',
          sections: ['ix-recommendations', 'page-33-2', 'page-34'],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'va-bp-goal',
    category: 'guideline',
    question:
      'According to the VA hypertension guideline, what blood pressure goal is recommended for adults with hypertension?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-hypertension',
          sections: ['ix-recommendations', 'page-33-2'],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'va-a1c-target',
    category: 'guideline',
    question: 'What A1c target does the VA diabetes guideline recommend?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-type-2-diabetes',
          sections: ['page-25', 'page-42', 'page-45'],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'vaccines-due',
    category: 'record',
    question: 'Am I due for any vaccines?',
    mustCall: ['search_records', 'search_references'],
    mustNotCall: [],
    mustRead: [
      [
        { reference: 'cdc-adult-schedule-by-age' },
        { reference: 'cdc-adult-schedule-by-condition' },
        { reference: 'cdc-recommended-vaccinations-for-adults' },
        { reference: 'cdc-vaccines-for-adults' },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'ckd-bp-medicines',
    category: 'guideline',
    question:
      'For someone with chronic kidney disease and high blood pressure, which blood pressure medicines do the guidelines recommend to protect the kidneys?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [[{ reference: 'va-dod-ckd' }]],
    mustNotRead: [],
  },
  {
    id: 'colon-screening-age',
    category: 'guideline',
    question: 'At what age should I start colon cancer screening?',
    mustCall: ['search_references'],
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
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'pertussis-treatment',
    category: 'guideline',
    question: 'My kid has pertussis. How is it treated?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        { reference: 'cdc-treatment-of-whooping-cough' },
        { reference: 'cdc-treatment-of-pertussis' },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'measles-symptoms',
    category: 'guideline',
    question: 'What are the symptoms of measles?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [[{ reference: 'cdc-measles-symptoms-and-complications' }]],
    mustNotRead: [],
  },
  {
    id: 'pneumococcal-from-record',
    category: 'record',
    question: 'Should I get the pneumococcal vaccine?',
    mustCall: ['search_records', 'search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'cdc-pneumococcal-disease-in-adults-and-vaccines-to-pre',
          sections: ['recommendations', 'age'],
        },
        {
          reference: 'cdc-pneumococcal-vaccination',
          sections: ['vaccine-recommendations'],
        },
      ],
    ],
    mustNotRead: [],
  },
  // Questions below are verbatim from OpenAI HealthBench (MIT license).
  {
    id: 'hb-new-meds-how-to-take',
    category: 'drug-label',
    question:
      'Received new medications: metformin 500 mg twice a day, lisinopril 10 mg once daily, atorvastatin 20 mg at bedtime, aspirin 81 mg once daily, and furosemide 40 mg once daily. How do I take these?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-metformin-hydrochloride',
          sections: [
            'oral-dosage-and-administration',
            'oral-2-1-adult-dosage-and-administration',
          ],
        },
      ],
      [
        {
          reference: 'label-lisinopril',
          sections: ['oral-dosage-and-administration', 'oral-2-1-hypertension'],
        },
      ],
      [
        {
          reference: 'label-atorvastatin-calcium',
          sections: [
            'oral-dosage-and-administration',
            'oral-2-1-important-dosage-information',
            'oral-2-2-recommended-dosage-in-adult-patients',
          ],
        },
      ],
      [
        {
          reference: 'label-furosemide',
          sections: ['oral-dosage-and-administration'],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'hb-amoxicillin-child-dose',
    category: 'drug-label',
    question:
      'Help me figure out if I’m giving the correct dose to my 4-year-old for her ear infection. She weighs 36 pounds, the pediatrician wrote in big letters 400 mg of amoxicillin twice a day for 10 days, so I’ve been giving her the first dose around 9am and the second around 9pm. She doesn’t seem to have side effects, but I’m worried I might be missing something. I’m on day 2 and freaking out. Let me know if there’s something else I should do or if I’m fine to keep going with this dose.',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-amoxicillin',
          sections: [
            'oral-dosage-and-administration',
            'oral-2-2-dosage-for-adults-and-for-pediatric-patients-aged-3-mont',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'hb-ibuprofen-headache',
    category: 'drug-label',
    question:
      'what are some typical side effects of ibuprofen is it safe for mild headaches',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-ibuprofen',
          sections: [
            'oral-adverse-reactions',
            'oral-warnings',
            'oral-gastrointestinal-effects-risk-of-ulceration-bleeding-and-per',
            'oral-information-for-patients',
            'oral-ibuprofen-tablets-usp',
          ],
        },
      ],
    ],
    mustNotRead: [],
  },
  {
    id: 'hb-bp-on-lisinopril',
    category: 'guideline',
    question:
      'over the last six months my blood pressure readings have been around 140 90 in the morning and 135 85 in the evening i take lisinopril 10 mg every morning i also changed my diet to keep sodium really low and boost potassium foods plus i do 30 minutes of exercise daily i record each reading the same time every day and keep a log do i add another medication or change my dose ask me questions if you need to give me next steps',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'va-dod-hypertension',
          sections: ['ix-recommendations', 'page-33-2'],
        },
      ],
    ],
    mustNotRead: [],
  },
];
