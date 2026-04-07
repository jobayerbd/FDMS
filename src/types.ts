export interface Pump {
  id: string;
  name: string;
  location: string;
  owner?: string;
  contact?: string;
}

export interface FuelStock {
  id: string;
  pumpId: string;
  fuelType: 'Octane' | 'Petrol' | 'Diesel';
  totalReceived: number;
  currentStock: number;
}

export interface Transaction {
  id: string;
  vehicleNumber: string;
  fuelType: 'Octane' | 'Petrol' | 'Diesel';
  quantity: number;
  pumpId: string;
  operatorId: string;
  timestamp: any;
}

export interface Vehicle {
  vehicleNumber: string;
  totalFuelTaken: number;
  lastTransactionAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'pumpOwner' | 'operator';
  assignedPumpId?: string;
  name?: string;
  isPreAssigned?: boolean;
}
