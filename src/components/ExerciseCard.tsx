/**
 * ExerciseCard Component
 *
 * LEARNING NOTES - USING SHADCN/UI COMPONENTS:
 *
 * 1. SHADCN/UI PHILOSOPHY:
 *    - Components are COPIED into your project (you own them)
 *    - Not installed from node_modules like MUI or Chakra
 *    - Can customize them however you want
 *
 * 2. CARD COMPONENT:
 *    shadcn Card is a composable component:
 *    - Card (container)
 *    - CardHeader, CardTitle, CardDescription (optional)
 *    - CardContent (main content)
 *    - CardFooter (optional)
 *
 * 3. BADGE COMPONENT:
 *    Perfect for tags - semantic HTML (not clickable)
 *    Has variants: default, secondary, destructive, outline
 *
 * 4. HYBRID APPROACH:
 *    - Use shadcn for generic components (Card, Badge)
 *    - Keep custom components when needed (our Button)
 *    - This is a practical React pattern
 */

import { Star } from 'lucide-react';
import type { Exercise } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

// Props interface - like defining @Input() properties in Angular
interface ExerciseCardProps {
  exercise: Exercise;
  onClick?: () => void; // Optional click handler - passed from parent
  isFavorite?: boolean; // Whether this exercise is starred
  onToggleFavorite?: () => void; // Toggle star on/off
  isHidden?: boolean; // Whether this exercise has been hidden
}

// Functional component - using shadcn components
function ExerciseCard({
  exercise,
  onClick,
  isFavorite,
  onToggleFavorite,
  isHidden,
}: ExerciseCardProps) {
  return (
    <Card
      className={`flex cursor-pointer flex-col transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:shadow-primary/30 ${isHidden ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="truncate text-primary hover:underline">{exercise.name}</CardTitle>
            {exercise.isCustom && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Custom
              </Badge>
            )}
          </div>
          {onToggleFavorite && (
            // p-1.5 expands the tap target to ~32px — closer to the 44px mobile guideline
            // without bloating the layout
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className="ml-2 shrink-0 p-1.5 transition-colors"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? (
                <Star className="h-5 w-5 fill-star text-star" />
              ) : (
                <Star className="h-5 w-5 text-muted-foreground hover:text-star" />
              )}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-0">
        {/* line-clamp-3 caps the preview so cards stay uniform height on mobile */}
        {exercise.summary && (
          <p className="line-clamp-3 text-sm leading-relaxed text-secondary-foreground">
            {exercise.summary}
          </p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {exercise.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="border-input text-xs text-primary">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ExerciseCard;
