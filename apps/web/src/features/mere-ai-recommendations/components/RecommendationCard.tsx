import React from 'react';
import { USPSTFRecommendationDocument } from '../../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.type';
import { hashStringToNumber } from '../helpers/hashStringToNumber';
import { color_pairs } from '../../../features/mere-ai-recommendations/constants/color_pairs';
import { getRandomColorPair } from '../../../features/mere-ai-recommendations/helpers/getRandomColorPair';

export const SkeletonRecommendationCard =
  function SkeletonRecommendationCard() {
    return (
      <div className="w-48 h-48 flex-none rounded-lg border bg-gray-200 p-4 shadow-sm animate-pulse">
        <p className="h-3 mb-2 w-36 rounded-sm bg-gray-500 pb-1 animate-pulse"></p>
        <p className="h-3 mb-3 w-32 rounded-sm bg-gray-500 pb-1 animate-pulse"></p>
        <p className="h-3 mb-2 w-30 rounded-sm bg-gray-300 pb-1 animate-pulse"></p>
        <p className="h-3 mb-2 w-28 rounded-sm bg-gray-300 pb-1 animate-pulse"></p>
        <p className="h-3 mb-2 w-26 rounded-sm bg-gray-300 pb-1 animate-pulse"></p>
        <p className="h-3 mb-2 w-22 rounded-sm bg-gray-300 pb-1 animate-pulse"></p>
        <p className="h-3 mb-2 w-28 rounded-sm bg-gray-300 pb-1 animate-pulse"></p>
      </div>
    );
  };

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
      className={`w-48 h-48 overflow-y-scroll flex-none rounded-lg border ${colorPair.border} p-4 shadow-sm ${colorPair.bg} ${colorPair.textDark} `}
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
