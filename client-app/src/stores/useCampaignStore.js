import { create } from 'zustand';

const useCampaignStore = create((set) => ({
    editMode: false,
    campaignData: null,
    setEditMode: (mode) => set({ editMode: mode }),
    setCampaignData: (data) => set({ campaignData: data }),
    reset: () => set({ editMode: false, campaignData: null })
}));

export default useCampaignStore;
