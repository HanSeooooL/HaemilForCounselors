import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple user flags (non-sensitive). If multi-user support is needed later, prefix keys with user id.
const INTRO_PROMPT_KEY = 'initial_questionnaire_prompt_done';
const QUESTIONNAIRE_DONE_KEY = 'initial_questionnaire_completed';

export async function getInitialQuestionnairePromptDone(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(INTRO_PROMPT_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setInitialQuestionnairePromptDone(): Promise<void> {
  try { await AsyncStorage.setItem(INTRO_PROMPT_KEY, '1'); } catch {}
}

export async function getInitialQuestionnaireCompleted(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(QUESTIONNAIRE_DONE_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setInitialQuestionnaireCompleted(): Promise<void> {
  try { await AsyncStorage.setItem(QUESTIONNAIRE_DONE_KEY, '1'); } catch {}
}

export const UserFlags = {
  getInitialQuestionnairePromptDone,
  setInitialQuestionnairePromptDone,
  getInitialQuestionnaireCompleted,
  setInitialQuestionnaireCompleted,
};

