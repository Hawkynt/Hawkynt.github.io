# Product Requirements Document: Subnet Calculator

## 1. Objective

The Subnet Calculator is a utility for network administrators, students, and IT professionals using the SynthelicZ OS. It provides an intuitive interface to calculate and visualize IPv4 subnetting information, helping users understand network ranges, masks, and binary representations.

## 2. Target Audience

*   Network administrators designing and troubleshooting networks.
*   Students learning about networking fundamentals and subnetting.
*   Software developers working with network configurations.

## 3. Core Features

### 3.1. Feature: IP and Mask Input
*   **Description:** Users can input an IPv4 address and a subnet mask to define the network they wish to analyze.
*   **User Stories:**
    *   As a user, I want to type an IPv4 address in a standard dotted-decimal format (e.g., `192.168.10.5`).
    *   As a user, I want to provide a subnet mask either in CIDR notation (e.g., `/24`) or dotted-decimal format (e.g., `255.255.255.0`).
    *   As a user, I want the application to automatically update the calculations whenever I change the IP address or the mask.
*   **Acceptance Criteria:**
    *   Input fields for IP and Mask are clearly labeled.
    *   The Mask input field can accept both `/` prefixed numbers (1-32) and a full dotted-decimal mask.
    *   Invalid inputs are handled gracefully, and calculated values are cleared or show an error state.

### 3.2. Feature: Calculated Network Properties
*   **Description:** The application automatically calculates and displays key properties of the specified subnet.
*   **User Stories:**
    *   As a user, I want to instantly see the calculated Network Address for my IP and mask.
    *   As a user, I want to see the Broadcast Address for the subnet.
    *   As a user, I want to know the total number of hosts and the number of usable hosts in the subnet.
    *   As a user, I want to see the range of usable host IP addresses.
*   **Acceptance Criteria:**
    *   All calculated fields are clearly labeled (Network, Broadcast, Usable Hosts, etc.).
    *   Values update immediately upon a valid change to the IP or mask inputs.
    *   Calculations are accurate according to standard IPv4 subnetting rules.

### 3.3. Feature: Interactive Bit-level Display
*   **Description:** An interactive, binary representation of the IP address and subnet mask allows for direct manipulation and a deeper understanding of the subnetting process.
*   **User Stories:**
    *   As a user, I want to see the 32-bit binary representation of my IP Address, the Subnet Mask, the Network Address, and the Broadcast Address.
    *   As a user, I want the binary representations to be aligned vertically in a clear, easy-to-read table.
    *   As a user, I want to be able to click on any bit in the Subnet Mask row to flip it (0 to 1 or 1 to 0).
    *   As a user, when I click a bit in the mask, I want all calculated values (dotted-decimal mask, CIDR, network address, etc.) to update instantly.
*   **Acceptance Criteria:**
    *   A view displays four rows of 32 bits each, separated into octets.
    *   The rows correspond to the IP, Mask, Network, and Broadcast addresses.
    *   The bits in the Subnet Mask row are interactive (clickable).
    *   Clicking a mask bit updates the entire application state correctly.
    *   The binary display updates when the user types a new IP address.

## 4. UI/UX Vision

The application will have a single, clear view. The top section will contain the IP address and Subnet/CIDR input fields. Below this, a section will be dedicated to the calculated results, presented as a clean list of key-value pairs. The bottom and most prominent section will be the interactive bit-level view, designed for clarity and hands-on learning.
