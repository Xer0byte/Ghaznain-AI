# Security Specification for Ghaznain AI

## 1. Data Invariants
- `users/{userId}`: A user can only manage their own profile. Admin can manage all profiles. `role` and `plan` are immutable by the user.
- `users/{userId}/conversations/{conversationId}`: Only the owner can read/write.
- `users/{userId}/conversations/{conversationId}/messages/{messageId}`: Only the owner can read/write.
- `users/{userId}/projects/{projectId}`: Only the owner can read/write.
- `users/{userId}/tasks/{taskId}`: Only the owner can read/write.

## 2. The "Dirty Dozen" Payloads (Deny List)
1. User tries to change their `role` to 'admin'.
2. User tries to change their `plan` to 'pro' without admin approval.
3. User tries to read another user's conversation.
4. User tries to write a message with a spoofed `userId`.
5. User tries to delete another user's task.
6. User tries to create a conversation for another user.
7. User tries to update `lastActive` for another user.
8. User tries to inject a massive string (1MB+) into a message.
9. User tries to create a user profile with an ID different from their Auth UID.
10. Anonymous user tries to write data.
11. User tries to manually update `subscriptionExpiresAt`.
12. User tries to update `signupLocation`.

## 3. Test Runner (Draft Concepts)
The tests will verify that `request.auth.uid` must match `{userId}` in all paths starting with `users/{userId}/`.
