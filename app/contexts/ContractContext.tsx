import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Web fallback using localStorage
const webStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  },
  
  async setItemAsync(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    }
  },
  
  async deleteItemAsync(key: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  }
};

const storage = Platform.OS === 'web' ? webStorage : SecureStore;

interface Contract {
  id: string;
  name: string;
  analysisDate: string;
  complianceScore: number;
  sessionId: string;
  data?: any;
  interactions?: number;
  modifications?: number;
  hasGeneratedContract?: boolean;
  fileSize?: string;
  lastViewed?: string;
}

interface ContractContextValue {
  contracts: Contract[];
  addContract: (contract: Contract) => void;
  removeContract: (id: string) => void;
  clearAllContracts: () => void;
  getContract: (id: string) => Contract | undefined;
  updateContract: (id: string, updates: Partial<Contract>) => void;
  isLoading: boolean;
}

const ContractContext = createContext<ContractContextValue | undefined>(
  undefined,
);

export const useContract = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContract must be used within a ContractProvider");
  }
  return context;
};

interface ContractProviderProps {
  children: ReactNode;
}

export const ContractProvider: React.FC<ContractProviderProps> = ({
  children,
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load contracts from storage on mount
  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setIsLoading(true);
      const stored = await storage.getItemAsync("shariaa_contracts");
      if (stored) {
        const parsedContracts = JSON.parse(stored);
        // Ensure all contracts have required fields with defaults
        const normalizedContracts = parsedContracts.map((contract: any) => ({
          interactions: 0,
          modifications: 0,
          hasGeneratedContract: false,
          fileSize: "Unknown",
          lastViewed: contract.analysisDate,
          ...contract,
        }));
        setContracts(normalizedContracts);
      }
    } catch (error) {
      console.error("Failed to load contracts:", error);
      setContracts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveContracts = async (newContracts: Contract[]) => {
    try {
      await storage.setItemAsync(
        "shariaa_contracts",
        JSON.stringify(newContracts),
      );
    } catch (error) {
      console.error("Failed to save contracts:", error);
    }
  };

  const addContract = (contract: Contract) => {
    const enrichedContract = {
      interactions: 0,
      modifications: 0,
      hasGeneratedContract: false,
      fileSize: "Unknown",
      lastViewed: new Date().toISOString(),
      ...contract,
    };

    const newContracts = [
      enrichedContract,
      ...contracts.filter((c) => c.id !== contract.id),
    ];
    setContracts(newContracts);
    saveContracts(newContracts);
  };

  const removeContract = (id: string) => {
    const newContracts = contracts.filter((c) => c.id !== id);
    setContracts(newContracts);
    saveContracts(newContracts);
  };

  const clearAllContracts = async () => {
    try {
      setContracts([]);
      await storage.deleteItemAsync("shariaa_contracts");
    } catch (error) {
      console.error("Failed to clear contracts:", error);
    }
  };

  const getContract = (id: string) => {
    return contracts.find((c) => c.id === id);
  };

  const updateContract = (id: string, updates: Partial<Contract>) => {
    const newContracts = contracts.map((contract) =>
      contract.id === id
        ? { ...contract, ...updates, lastViewed: new Date().toISOString() }
        : contract,
    );
    setContracts(newContracts);
    saveContracts(newContracts);
  };

  return (
    <ContractContext.Provider
      value={{
        contracts,
        addContract,
        removeContract,
        clearAllContracts,
        getContract,
        updateContract,
        isLoading,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};

export default ContractProvider;
