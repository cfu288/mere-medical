import React from 'react';
import { USPSTFRecommendationDocument } from '../../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.type';
import { hashStringToNumber } from '../helpers/hashStringToNumber';
import { color_pairs } from 'apps/web/src/features/preventative-medicine-recommendations/constants/color_pairs';
import { getRandomColorPair } from 'apps/web/src/features/preventative-medicine-recommendations/helpers/getRandomColorPair';

export const RecommendationCard = function RecommendationCard({
  recommendation,
}: {
  recommendation: USPSTFRecommendationDocument;
}): JSX.Element {
  const colorPair = getRandomColorPair(
    hashStringToNumber(recommendation.id) % color_pairs.length,
  );

  if (!recommendation.eligible) {
    return <></>;
  }

  return (
    <div
      key={recommendation.id}
      className={`max-w-48 max-h-48 overflow-y-scroll flex-none rounded-lg border ${colorPair.border} p-4 shadow-sm ${colorPair.bg} ${colorPair.textDark} `}
    >
      <a
        href={
          recommendation.url
            ? recommendation.url
            : 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-and-b-recommendations'
        }
        target="_blank"
        rel="noreferrer"
        className={`hover:underline ${colorPair.textDark} ${colorPair.textHover}`}
      >
        <p className="text-sm font-bold pb-1">
          {recommendation.recommendation}
        </p>
      </a>
      <p className={`text-sm ${colorPair.textDark}`}>
        <i>{recommendation.topic + ': '}</i>
        {recommendation.description}
      </p>
    </div>
  );
};
