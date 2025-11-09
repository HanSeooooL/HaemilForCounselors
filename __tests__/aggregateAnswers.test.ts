import { aggregateAnswers } from '../src/screens/InitialQuestionnaireForm';

describe('aggregateAnswers', () => {
  it('기본 단일 문항 그대로 유지', () => {
    expect(aggregateAnswers({ q1: 2, q2: 1 })).toEqual({ q1: 2, q2: 1 });
  });
  it('자식 문항 점수 합산 (q7 + q7_1 + q7_2)', () => {
    const answers = { q7: 1, q7_1: 1, q7_2: 2 };
    expect(aggregateAnswers(answers)).toEqual({ q7: 1 + 1 + 2 });
  });
  it('부모 점수 포함 후 자식 합산', () => {
    const answers = { q15: 2, q15_1: 1 };
    expect(aggregateAnswers(answers)).toEqual({ q15: 2 + 1 });
  });
  it('조건 제거된 자식은 집계 제외', () => {
    const answers = { q15: 1 }; // q15_1 없어야 함
    expect(aggregateAnswers(answers)).toEqual({ q15: 1 });
  });
});

