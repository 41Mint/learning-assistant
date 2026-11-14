import { create } from 'zustand';
import type { SavedExercise } from '../types';

export type GrowthDrag = { cardId: string } | { exercise: SavedExercise };
export const GROWTH_DRAG_TYPE = 'application/x-learning-assistant-card';

export const useGrowthDragStore = create<{ drag?: GrowthDrag }>(() => ({}));
