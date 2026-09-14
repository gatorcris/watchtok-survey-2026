export function classifySyncFailure(error = {}) {
  if (error.status === 401) return "SESSION-401";
  if (error.status === 403) return "PERMISSION-403";
  if (Number(error.status) >= 500) return `SERVICE-${error.status}`;
  if (error.status) return `SAVE-${error.status}`;
  return "NETWORK";
}

export function createRecoverySnapshot(state, surveyVersion, generatedAt = new Date().toISOString()) {
  return {
    recovery_format: "watchtok-survey-v1",
    survey_version: surveyVersion,
    generated_at: generatedAt,
    status: state.status,
    current_question_id: state.currentQuestionId,
    started_at: state.startedAt,
    updated_at: state.updatedAt,
    referral_code: state.referral,
    answers: state.answers
  };
}

export function createSerialQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.then(task, task);
    tail = result.catch(() => {});
    return result;
  };
}
