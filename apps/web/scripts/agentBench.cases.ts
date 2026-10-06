import { Retrieved } from '../src/features/patient-context/agent/tools';

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
  /** Patient data a tool result must have shown; each entry is satisfied by any one of its items. */
  mustRetrieve: Retrieved[][];
};

export const BENCH_CASES: BenchCase[] = [
  {
    id: 'eliquis-dose-reduction',
    category: 'drug-label',
    question:
      'I take Eliquis for atrial fibrillation. When would my dose need to be lowered, and to what dose?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-apixaban',
          sections: [
            'oral-reduction-of-risk-of-stroke-and-systemic-embolism-in-patient',
            'oral-reduction-of-risk-of-stroke-and-systemic-embolism-in-patient-2',
            'oral-dosage-and-administration',
            'oral-2-6-combined-p-gp-and-strong-cyp3a4-inhibitors',
            'oral-7-1-combined-p-gp-and-strong-cyp3a4-inhibitors',
            'oral-drug-interactions',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
          sections: [
            'oral-dosage-and-administration',
            'oral-reduction-of-risk-of-stroke-and-systemic-embolism-in-patient',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
          sections: [
            'oral-patients-with-end-stage-renal-disease-on-dialysis',
            'oral-prophylaxis-of-deep-vein-thrombosis-following-hip-or-knee-re-2',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
          sections: ['oral-7-2-combined-p-gp-and-strong-cyp3a4-inducers'],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
  },
  {
    id: 'eliquis-for-someone-else',
    category: 'drug-label',
    question: 'What dose of Eliquis should I give my 85-year-old mother?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-apixaban',
          sections: [
            'oral-reduction-of-risk-of-stroke-and-systemic-embolism-in-patient',
            'oral-reduction-of-risk-of-stroke-and-systemic-embolism-in-patient-2',
            'oral-dosage-and-administration',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
            'oral-2-1-myocardial-infarction',
            'oral-17-patient-counseling-information',
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
            'oral-2-3-heart-failure',
            'oral-14-1-hypertension',
            'oral-14-2-angina-pectoris',
            'oral-17-patient-counseling-information',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
            'oral-select-azole-antifungals-or-macrolide-antibiotics',
            'oral-7-1-drug-interactions-that-may-increase-the-risk-of-myopathy',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
        {
          reference: 'label-amlodipine-besylate',
          sections: ['oral-simvastatin'],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
            'oral-5-1-lactic-acidosis',
          ],
        },
        {
          reference: 'va-dod-ckd',
          sections: ['appendix-l-list-of-pharmacotherapies'],
        },
        {
          reference: 'va-dod-type-2-diabetes',
          sections: ['appendix-c-pharmacotherapy'],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
            'oral-medication-guide',
            'oral-12-3-pharmacokinetics',
          ],
        },
        {
          reference: 'label-omeprazole',
          sections: [
            'oral-5-7-interaction-with-clopidogrel',
            'oral-7-drug-interactions',
            'oral-17-patient-counseling-information',
            'oral-warnings-and-precautions',
            'oral-12-3-pharmacokinetics',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
            'subcutaneous-5-7-serotonin-syndrome',
            'subcutaneous-7-4-selective-serotonin-reuptake-inhibitors-serotonin-norepi',
            'subcutaneous-17-patient-counseling-information',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
            'oral-contraindications',
            'oral-17-patient-counseling-information',
            'oral-medication-guide',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
            'response-to-public-comment',
          ],
        },
        {
          reference: 'uspstf-a-and-b',
          sections: ['a-b-recommendations'],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
  },
  {
    id: 'latest-cholesterol',
    category: 'record',
    question: 'What was my most recent cholesterol result?',
    mustCall: ['search_labs'],
    mustNotCall: ['search_references', 'read_section'],
    mustRead: [],
    mustNotRead: [],
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
    mustNotRead: [],
    mustRetrieve: [
      [
        {
          kind: 'note',
          id: 'n1',
        },
        {
          kind: 'note',
          id: 'n8',
        },
      ],
    ],
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
    mustNotRead: [],
    mustRetrieve: [],
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
    mustNotRead: [],
    mustRetrieve: [],
  },
  {
    id: 'vaccines-due',
    category: 'record',
    question: 'Am I due for any vaccines?',
    mustCall: ['search_records', 'search_references'],
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
    mustNotRead: [],
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
  },
  {
    id: 'ckd-bp-medicines',
    category: 'guideline',
    question:
      'For someone with chronic kidney disease and high blood pressure, which blood pressure medicines do the guidelines recommend to protect the kidneys?',
    mustCall: ['search_references'],
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
    mustNotRead: [],
    mustRetrieve: [],
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
    mustNotRead: [],
    mustRetrieve: [],
  },
  {
    id: 'pertussis-treatment',
    category: 'guideline',
    question: 'My kid has pertussis. How is it treated?',
    mustCall: ['search_references'],
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
    mustNotRead: [],
    mustRetrieve: [],
  },
  {
    id: 'measles-symptoms',
    category: 'guideline',
    question: 'What are the symptoms of measles?',
    mustCall: ['search_references'],
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
    mustNotRead: [],
    mustRetrieve: [],
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
    mustNotRead: [],
    mustRetrieve: [
      [
        {
          kind: 'record',
          type: 'immunization',
          name: 'Pneumococcal Conjugate PCV 13',
        },
      ],
    ],
  },
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
            'oral-patient-information',
          ],
        },
      ],
      [
        {
          reference: 'label-lisinopril',
          sections: [
            'oral-dosage-and-administration',
            'oral-2-1-hypertension',
            'oral-2-2-heart-failure',
            'oral-2-3-reduction-of-mortality-in-acute-myocardial-infarction',
          ],
        },
      ],
      [
        {
          reference: 'label-atorvastatin-calcium',
          sections: [
            'oral-dosage-and-administration',
            'oral-2-1-important-dosage-information',
            'oral-2-2-recommended-dosage-in-adult-patients',
            'oral-patient-information',
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
    mustRetrieve: [],
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
    mustRetrieve: [],
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
            'oral-gastrointestinal-effects-risk-of-ulceration-bleeding-and-per',
            'oral-information-for-patients',
            'oral-ibuprofen-tablets-usp',
            'oral-how-supplied',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [],
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
    mustNotRead: [],
    mustRetrieve: [],
  },
  {
    id: 'metformin-safe',
    category: 'drug-label',
    question:
      'I was just prescribed metformin 1000 mg twice a day. Is that safe?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-metformin-hydrochloride',
          sections: [
            'oral-2-2-recommendations-for-use-in-renal-impairment',
            'oral-8-6-renal-impairment',
            'oral-4-contraindications',
            'oral-contraindications',
            'oral-dosage-and-administration',
            'oral-5-1-lactic-acidosis',
          ],
        },
        {
          reference: 'va-dod-ckd',
          sections: ['appendix-l-list-of-pharmacotherapies'],
        },
        {
          reference: 'va-dod-type-2-diabetes',
          sections: ['appendix-c-pharmacotherapy'],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [
      [
        {
          kind: 'lab',
          analyte: '77147-7',
        },
      ],
    ],
  },
  {
    id: 'hydrochlorothiazide-safe',
    category: 'drug-label',
    question:
      'My doctor wants to start me on hydrochlorothiazide. Is that safe?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-hydrochlorothiazide',
          sections: [
            'oral-5-3-metabolic-disturbances',
            'oral-warnings-and-precautions',
          ],
        },
        {
          reference: 'va-dod-ckd',
          sections: ['appendix-l-list-of-pharmacotherapies'],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [
      [
        {
          kind: 'lab',
          analyte: '17861-6',
        },
        {
          kind: 'lab',
          analyte: '2731-8',
        },
        {
          kind: 'lab',
          analyte: '17864-0',
        },
        {
          kind: 'record',
          type: 'condition',
          name: 'Serum calcium elevated',
        },
      ],
    ],
  },
  {
    id: 'amoxicillin-safe',
    category: 'drug-label',
    question: 'My dentist prescribed amoxicillin. Is that safe?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-amoxicillin',
          sections: [
            'oral-4-contraindications',
            'oral-contraindications',
            'oral-5-1-anaphylactic-reactions',
            'oral-warnings-and-precautions',
            'oral-17-patient-counseling-information',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [
      [
        {
          kind: 'record',
          type: 'allergy',
          name: 'PENICILLINS',
        },
        {
          kind: 'record',
          type: 'condition',
          name: 'Penicillin rash',
        },
      ],
      [
        {
          kind: 'note',
          id: 'n1',
        },
        {
          kind: 'note',
          id: 'n2',
        },
      ],
    ],
  },
  {
    id: 'meloxicam-daily-safe',
    category: 'drug-label',
    question: 'Is it safe to take meloxicam every day?',
    mustCall: ['search_references'],
    mustNotCall: [],
    mustRead: [
      [
        {
          reference: 'label-meloxicam',
          sections: [
            'oral-5-6-renal-toxicity-and-hyperkalemia',
            'oral-2-5-renal-impairment',
            'oral-8-7-renal-impairment',
            'oral-warnings-and-precautions',
            'oral-5-14-laboratory-monitoring',
            'oral-17-patient-counseling-information',
            'oral-12-3-pharmacokinetics',
          ],
        },
      ],
    ],
    mustNotRead: [],
    mustRetrieve: [
      [
        {
          kind: 'lab',
          analyte: '77147-7',
        },
        {
          kind: 'lab',
          analyte: '2160-0',
        },
        {
          kind: 'lab',
          analyte: '35592-5',
        },
      ],
    ],
  },
  {
    id: 'hep-b-nursing-school',
    category: 'guideline',
    question: 'Do I need a hepatitis B vaccine before nursing school?',
    mustCall: ['search_references'],
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
    mustNotRead: [],
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
  },
  {
    id: 'metformin-dose-not-on-it',
    category: 'record',
    question: 'Is my metformin dose right?',
    mustCall: [],
    mustNotCall: [],
    mustRead: [],
    mustNotRead: [],
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
  },
];
