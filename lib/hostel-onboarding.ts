export interface HostelOnboardingDraftData {
  basic: {
    name: string;
    address: string;
    city: string;
    state: string;
    phone: string;
    email: string;
    gstin: string;
    amenities: {
      wifi: boolean;
      hot_water: boolean;
      washing_machine: boolean;
      fridge: boolean;
      ac: boolean;
      cctv: boolean;
      power_backup: boolean;
      housekeeping: boolean;
    };
    food: {
      mess_available: boolean;
      breakfast: boolean;
      lunch: boolean;
      dinner: boolean;
      veg_only: boolean;
      non_veg: boolean;
      food_notes: string;
    };
  };
  totalFloors: number;
  defaultSharing: string;
  defaultRent: string;
  floors: {
    floorNumber: number;
    label: string;
    roomCount: number;
    rooms: {
      roomNumber: string;
      sharing: string;
      customSharing: string;
      rent: string;
    }[];
  }[];
}

export interface PendingHostelOnboarding {
  onboarding_id: string;
  hostel_name: string;
  draft: HostelOnboardingDraftData;
  status: 'PENDING_PAYMENT' | 'PROCESSING' | 'PAYMENT_FAILED';
  billingMode?: 'AUTO_PAY' | 'ONE_TIME';
}
