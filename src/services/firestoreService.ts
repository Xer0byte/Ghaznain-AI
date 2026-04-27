import { 
  collection, 
  doc, 
  getDoc, 
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
      const userDoc = await getDoc(doc(db, path));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async createUserProfile(userId: string, data: any) {
    const path = `users/${userId}`;
    try {
      const userRef = doc(db, path);
      const profile = {
        ...data,
        role: 'user',
        plan: 'free',
        subscriptionStatus: 'none',
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
      await updateDoc(userRef, { ...data, lastActive: serverTimestamp() });
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
      await updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
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
      await updateDoc(doc(db, path), { completed });
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
  }
};
