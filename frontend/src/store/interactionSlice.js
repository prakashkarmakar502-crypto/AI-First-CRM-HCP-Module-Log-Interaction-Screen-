import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  hcpName: "",
  interactionType: "Meeting",
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  attendees: [],
  topics: "",
  materialsShared: [],
  samplesDistributed: [],
  sentiment: "Neutral",
  outcomes: "",
  followUpActions: "",
  suggestedFollowUps: [],
  lastTouched: [], // field keys the agent just changed, used to drive the highlight flash
};

const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    setField(state, action) {
      const { field, value } = action.payload;
      state[field] = value;
      state.lastTouched = [field];
    },
    addAttendee(state, action) {
      if (!state.attendees.includes(action.payload)) {
        state.attendees.push(action.payload);
        state.lastTouched = ["attendees"];
      }
    },
    removeAttendee(state, action) {
      state.attendees = state.attendees.filter((a) => a !== action.payload);
    },
    addMaterial(state, action) {
      if (!state.materialsShared.includes(action.payload)) {
        state.materialsShared.push(action.payload);
        state.lastTouched = ["materialsShared"];
      }
    },
    removeMaterial(state, action) {
      state.materialsShared = state.materialsShared.filter((m) => m !== action.payload);
    },
    addSample(state, action) {
      if (!state.samplesDistributed.includes(action.payload)) {
        state.samplesDistributed.push(action.payload);
        state.lastTouched = ["samplesDistributed"];
      }
    },
    removeSample(state, action) {
      state.samplesDistributed = state.samplesDistributed.filter((s) => s !== action.payload);
    },
    setSuggestions(state, action) {
      state.suggestedFollowUps = action.payload;
    },
    useSuggestion(state, action) {
      const sep = state.followUpActions.trim().length ? "\n" : "";
      state.followUpActions += sep + "- " + action.payload;
      state.lastTouched = ["followUpActions"];
    },
    // Applied whenever the AI Assistant panel returns a form_diff from POST /api/chat
    bulkUpdate(state, action) {
      const { diff, touched } = action.payload;
      Object.assign(state, diff);
      state.lastTouched = touched || Object.keys(diff);
    },
    clearTouched(state) {
      state.lastTouched = [];
    },
  },
});

export const {
  setField, addAttendee, removeAttendee,
  addMaterial, removeMaterial, addSample, removeSample,
  setSuggestions, useSuggestion, bulkUpdate, clearTouched,
} = interactionSlice.actions;

export default interactionSlice.reducer;
