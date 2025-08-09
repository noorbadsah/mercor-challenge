# Mercor Referral Network – Full Implementation

## 📸 Project Banners

<img width="1901" height="747" alt="Mercor Referral Network Banner 1" src="https://github.com/user-attachments/assets/da027d2f-2cbf-4480-aad3-b94468ce91f6" />

<img width="1052" height="674" alt="Mercor Referral Network Banner 2" src="https://github.com/user-attachments/assets/1d54e7ae-9554-4f6d-a55d-036370fa9e79" />

---

## 📖 Project Overview
This repository contains the **complete solution** to the **Mercor Take-Home Referral Network Challenge (Parts 1–5)**.

The project models a **professional-grade referral network** with:
- User and referral relationship management.
- Influence analytics by three different metrics (Reach, Unique Reach, Flow Centrality).
- Growth simulation over time.
- Bonus optimization to reach hiring targets efficiently.

The visual banners above represent the **graph-based referral portal** with analytics and leaderboard views implemented in this project.

---

## 1. Language & Setup

- **Language:** JavaScript (Node.js)
- **Version:** >= 18.x
- **Package Manager:** npm
- **Testing Framework:** Jest
- **Runtime Requirements:** None — runs directly with Node.js.

### Install Dependencies
npm install

This will install Jest and all other dependencies declared in package.json.

Run the Test Suite

npm test

This runs the full test suite and verifies that your local environment is correctly set up.

2. Design Choices
Part 1 – Data Structure

Choice: Directed Acyclic Graph (DAG) stored as a Map<string, Set<string>>.

Reasoning: O(1) add/lookups, no duplicates, fast traversal, simple cycle detection.

Rules enforced: No self-referrals, unique referrer per candidate, acyclic structure.

3. Top Referrers by Reach

Method: getTopReferrersByReach(k)

How to choose k:

Choose k based on the reporting need:

Small k (e.g., 3–10) for leaderboard display.

Larger k (e.g., 20+) for analytics dashboards or reports.

4. Metric Comparison

Metric	Description	Best Use Case

Reach	Total direct + indirect referrals	Ranking by overall volume

Unique Reach	Unique audience coverage	Avoiding overlap when targeting new users

Flow Centrality	Measures brokerage power	Identifying key connectors whose removal would fragment the network

5. Time Complexity

Adding user/referral: O(1) for insertion + O(V+E) for cycle check.
BFS reach: O(V+E)
Unique Reach Expansion: O(V × (V+E))
Flow Centrality: O(V × (V × (V+E))) worst case.
Simulation: O(days)
Bonus search: O(log(max_bonus/10) × days)

5. Time Complexity
Adding user/referral: O(1) for insertion + O(V+E) for cycle check.

BFS reach: O(V+E)

Unique Reach Expansion: O(V × (V+E))

Flow Centrality: O(V × (V × (V+E))) worst case.

Simulation: O(days)

Bonus search: O(log(max_bonus/10) × days)

## Repository Structure
<img width="216" height="251" alt="image" src="https://github.com/user-attachments/assets/2c6ba8d2-bed2-4a41-b4fc-4b1b8572e5e1" />



