import { IntentHandler } from './types';
import { useStore } from '@/store';
import { AppView } from '@/types';

export const handleNavigate: IntentHandler = ({ command, navigate }) => {
  const { view } = command.entities;
  if (!view) return { success: false, message: 'Which section should I open?' };
  navigate(view as AppView);
  return { success: true, message: `📍 Navigating to ${view}` };
};

export const handleSearchAction: IntentHandler = ({ command, navigate, setSearchQuery }) => {
  const { searchQuery } = command.entities;
  if (!searchQuery) return { success: false, message: 'What should I search for?' };
  if (setSearchQuery) setSearchQuery(searchQuery);
  navigate('history');
  return { success: true, message: `🔍 Searching for "${searchQuery}" in history…` };
};

export const handleReportExport: IntentHandler = ({ onExport }) => {
  onExport();
  return { success: true, message: '📄 Generating your PDF report…' };
};

export const handleHelp: IntentHandler = () => {
  return {
    success: true,
    message:
      '📋 Supported Commands:\n' +
      '• "Spent 500 on Food"\n' +
      '• "Set Rent budget to 15000"\n' +
      '• "Add 5 expenses" (Batch mode)\n' +
      '• "Summarize this month"\n' +
      '• "Navigate to Analytics"\n' +
      '• "Export PDF report"',
  };
};

export const handleUndoAction: IntentHandler = () => {
  return { success: true, message: `Attempting to undo the last action...`, undoable: false };
};

export const handleQuestAction: IntentHandler = ({ command, navigate }) => {
  const store = useStore.getState();
  const { actionType } = command.entities;
  if (actionType === 'check') {
    const streak = store.streak || 0;
    return { success: true, message: `🔥 You are on a ${streak} day streak! Keep it up.` };
  }
  navigate('dashboard');
  return { success: true, message: `🎯 Opening your quests and challenges…` };
};

export const handleQuestClaim: IntentHandler = ({ command }) => {
  const store = useStore.getState();
  const { name } = command.entities;
  const quest = store.quests?.find(
    q =>
      !q.completed &&
      q.progress >= 100 &&
      (!name || q.title.toLowerCase().includes(name.toLowerCase()))
  );
  if (!quest)
    return { success: false, message: `I couldn't find any completed quests to claim right now.` };

  store.completeQuest(quest.id);
  return {
    success: true,
    message: `🎉 Claimed reward for quest: ${quest.title}! You earned ${quest.xpReward} XP.`,
    undoable: false,
  };
};
