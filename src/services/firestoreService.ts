import { 
  collection, 
  doc, 
  getDoc, 
  getDocFromServer,
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const firestoreService = {
  // User Profile
  async getUserProfile(userId: string) {
    const path = `users/${userId}`;
    try {
      // Use getDocFromServer to ensure we are actually connected
      const userDoc = await getDocFromServer(doc(db, path));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error: any) {
      // If server fetch fails, try normal getDoc as fallback (might use cache)
      console.warn("Server fetch failed, trying generic getDoc:", error.message);
      try {
        const userDoc = await getDoc(doc(db, path));
        return userDoc.exists() ? userDoc.data() : null;
      } catch (innerError) {
        handleFirestoreError(innerError, OperationType.GET, path);
      }
    }
  },

  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      return true;
    } catch (error: any) {
      if (error.message && error.message.includes('offline')) {
        console.error("Firestore test connection: Client is offline.");
        return false;
      }
      // Permission denied is also a sign of being "online" but just not authorized for this specific path
      if (error.code === 'permission-denied') return true;
      return false;
    }
  },

  async createUserProfile(userId: string, data: any) {
    const path = `users/${userId}`;
    const adminEmails = [
      'ghaznain1122@gmail.com',
      'mr.ghaznain@gmail.com',
      'mr.house1122@gmail.com',
      'lawandknowledgeacademy@gmail.com'
    ];
    const isAdmin = data.email && adminEmails.includes(data.email.toLowerCase());

    try {
      const userRef = doc(db, path);
      const profile = {
        ...data,
        role: isAdmin ? 'admin' : 'user',
        plan: isAdmin ? 'pro' : 'free',
        subscriptionStatus: isAdmin ? 'active' : 'none',
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        messageCount: 0,
      };
      await setDoc(userRef, profile);
      return profile;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateUserProfile(userId: string, data: any) {
    const path = `users/${userId}`;
    try {
      const userRef = doc(db, path);
      // Use setDoc with merge instead of updateDoc to handle cases where doc might not exist yet
      await setDoc(userRef, { ...data, lastActive: serverTimestamp() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Conversations
  subscribeToConversations(userId: string, callback: (convs: any[]) => void) {
    const path = `users/${userId}/conversations`;
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(convs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async createConversation(userId: string, title: string = 'New Chat', isPrivate: boolean = false) {
    const path = `users/${userId}/conversations`;
    try {
      const data = {
        userId,
        title,
        isPrivate,
        isPinned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateConversation(userId: string, conversationId: string, data: any) {
    const path = `users/${userId}/conversations/${conversationId}`;
    try {
      // Use setDoc with merge for robustness against missing docs during rapid updates
      await setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteConversation(userId: string, conversationId: string) {
    const path = `users/${userId}/conversations/${conversationId}`;
    try {
      // Note: Ideally we delete messages too, but standard firestore delete doesn't cascade.
      // We'll just delete the conversation doc for now or use a batch if needed.
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Messages
  subscribeToMessages(userId: string, conversationId: string, callback: (messages: any[]) => void) {
    const path = `users/${userId}/conversations/${conversationId}/messages`;
    const q = query(collection(db, path), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async addMessage(userId: string, conversationId: string, message: { role: string, text: string, imageUrl?: string | null }) {
    const path = `users/${userId}/conversations/${conversationId}/messages`;
    try {
      const data = {
        ...message,
        userId,
        conversationId,
        timestamp: serverTimestamp()
      };
      await addDoc(collection(db, path), data);
      // Update parent conversation updatedAt
      await this.updateConversation(userId, conversationId, {});
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // Projects
  subscribeToProjects(userId: string, callback: (projects: any[]) => void) {
    const path = `users/${userId}/projects`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(projects);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async saveProject(userId: string, project: { name: string, description: string, content: string }) {
    const path = `users/${userId}/projects`;
    try {
      const data = {
        ...project,
        userId,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteProject(userId: string, projectId: string) {
    const path = `users/${userId}/projects/${projectId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Tasks
  subscribeToTasks(userId: string, callback: (tasks: any[]) => void) {
    const path = `users/${userId}/tasks`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(tasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async addTask(userId: string, title: string) {
    const path = `users/${userId}/tasks`;
    try {
      const data = {
        userId,
        title,
        completed: false,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, path), data);
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateTask(userId: string, taskId: string, completed: boolean) {
    const path = `users/${userId}/tasks/${taskId}`;
    try {
      await setDoc(doc(db, path), { completed }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteTask(userId: string, taskId: string) {
    const path = `users/${userId}/tasks/${taskId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Subscriptions / Upgrades
  async submitUpgradeRequest(userId: string, data: any) {
    const userPath = `users/${userId}/upgradeRequests`;
    const globalPath = `upgradeRequests`;
    try {
      const payload = {
        ...data,
        userId,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      // Save to user subcollection
      await addDoc(collection(db, userPath), payload);
      // Save to global collection for admin convenience
      await addDoc(collection(db, globalPath), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  },

  // Admin Methods (Note: These require appropriate rules)
  subscribeToAllUsers(callback: (users: any[]) => void) {
    const path = `users`;
    return onSnapshot(collection(db, path), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToAllUpgradeRequests(callback: (requests: any[]) => void) {
    const path = `upgradeRequests`;
    const q = query(collection(db, path), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(requests);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async handleSubscriptionAdmin(userId: string, requestId: string, action: 'approve' | 'reject', plan: string) {
    const userPath = `users/${userId}`;
    const requestPath = `upgradeRequests/${requestId}`;
    try {
      const batch = writeBatch(db);
      const userRef = doc(db, userPath);
      const requestRef = doc(db, requestPath);
      
      if (action === 'approve') {
        batch.set(userRef, { plan, subscriptionStatus: 'active' }, { merge: true });
      }
      
      batch.set(requestRef, { status: action }, { merge: true });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, requestPath);
    }
  }
};
