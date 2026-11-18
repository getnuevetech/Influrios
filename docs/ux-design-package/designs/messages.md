# Design — Messages

**Objective:** Conversation list with unread, latest message, collaboration context, accessible reply.  
**Role:** Influencer (Business parity later if shared inbox)  
**Evidence:** `influencer/desktop/messages.png`, `messages-state.png`

---

## 1. Desktop list

```
Messages
[Search conversations]
┌ Unread · ABC Holdings · 4th Test Campaign     ┐
│ Latest: “Can you share the draft caption?” 2h │
├───────────────────────────────────────────────┤
│ Read · …                                      │
└───────────────────────────────────────────────┘
```

Select row → split view or centered thread popup (prefer **split on desktop**, **full-screen thread on mobile** — thread is a conversation workspace, not a tiny popup).

---

## 2. Thread

- Header: counterparty + collaboration link  
- Message list; composer with Send  
- Keyboard: focus composer; Esc returns to list on mobile  

---

## 3. Empty / error

- Empty: “No messages yet”  
- Send error: banner above composer; text retained
