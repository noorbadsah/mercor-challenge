# Mercor Referral Network – Full Implementation

## 📸 Project Banners

<img width="1901" height="747" alt="Mercor Referral Network Banner 1" src="https://github.com/user-attachments/assets/da027d2f-2cbf-4480-aad3-b94468ce91f6" />

<img width="1052" height="674" alt="Mercor Referral Network Banner 2" src="https://github.com/user-attachments/assets/1d54e7ae-9554-4f6d-a55d-036370fa9e79" />

---

## 📖 Project Overview
This repository contains the complete solution to the Mercor Take-Home Referral Network Challenge (Parts 1–5).

The project models a professional-grade referral network with:

- User and referral relationship management.
- Influence analytics by three different metrics (Reach, Unique Reach, Flow Centrality).
- Growth simulation over time.
- Bonus optimization to reach hiring targets efficiently.

The visual banners above represent the graph-based referral portal with analytics and leaderboard views implemented in this project.

---

## 1. Language & Setup

**Language:** JavaScript (Node.js)  
**Version:** >= 18.x  
**Package Manager:** npm  
**Testing Framework:** Jest  
**Runtime Requirements:** None — runs directly with Node.js.

### Install Dependencies
```bash
npm install
```
This will install Jest and all other dependencies declared in `package.json`.

### Run the Test Suite
```bash
npm test
```
This runs the full test suite and verifies that your local environment is correctly set up.

---

## 2. Design Choices
**Choice:** Directed Acyclic Graph (DAG) stored as a `Map<string, Set<string>>`.

**Reasoning:**  
- O(1) add/lookups  
- No duplicates  
- Fast traversal  
- Simple cycle detection  

**Rules enforced:**  
- No self-referrals  
- Unique referrer per candidate  
- Acyclic structure

---

## 3. Top Referrers by Reach
**Method:** `getTopReferrersByReach(k)`

**How to choose k:**
- Small k (e.g., 3–10) for leaderboard display.
- Larger k (e.g., 20+) for analytics dashboards or reports.

---

## 4. Metric Comparison

| Metric          | Description                       | Best Use Case |
|----------------|-----------------------------------|---------------|
| Reach          | Total direct + indirect referrals | Ranking by overall volume |
| Unique Reach   | Unique audience coverage          | Avoiding overlap when targeting new users |
| Flow Centrality| Measures brokerage power          | Identifying key connectors whose removal would fragment the network |

---

## 5. Time Complexity

- Adding user/referral: **O(1)** for insertion + **O(V+E)** for cycle check  
- BFS reach: **O(V+E)**  
- Unique Reach Expansion: **O(V × (V+E))**  
- Flow Centrality: **O(V × (V × (V+E)))** worst case  
- Simulation: **O(days)**  
- Bonus search: **O(log(max_bonus/10) × days)**  

---

## 6. Approach

**Part 1:** Built the referral network as a Directed Acyclic Graph (DAG) using `Map<string, Set<string>>` to store user–referral relationships.  
Enforced constraints:  
- No self-referrals  
- Unique referrer per candidate  
- Prevented cycles by rejecting edges that would introduce them.

**Part 2:** Implemented BFS to calculate total reach (direct + indirect) for each user.

**Part 3:** Added two more influence metrics:  
- Unique Reach Expansion — greedy algorithm to maximize unique audience coverage.  
- Flow Centrality — counted how often a user appears on shortest paths between others.

**Part 4:** Simulated network growth over days using probability and referral capacity constraints.

**Part 5:** Used binary search over bonus amounts to find the minimum required bonus for a given hiring target, using the simulation logic from Part 4.

---

## 7. Time Spent
Approx. **7–8 hours** in total:  
- Parts 1–3: ~3 hours (data structure + algorithms)  
- Part 4: ~2 hours (simulation)  
- Part 5: ~1.5 hours (bonus optimization)  
- Testing & documentation: ~1 hour  

--- 

## 8. AI Tools Usage
AI assistants (ChatGPT) were used only for:  
- Debugging assistance  
- Brainstorming alternative approaches  
- Formatting documentation  

**All core logic, algorithms, and implementation decisions were self-developed and fully understood by me.**


## Repository Structure
<img width="216" height="251" alt="image" src="https://github.com/user-attachments/assets/2c6ba8d2-bed2-4a41-b4fc-4b1b8572e5e1" />





