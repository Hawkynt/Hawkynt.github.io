# Subnet Calculator

An IPv4 subnet calculator for the »SynthelicZ« desktop that computes network properties, displays binary representations with interactive bit toggling, and generates subnet division tables. It provides instant feedback as you type, with CIDR notation, subnet mask, and quick-select shortcuts.

## Product Requirements

### Purpose
The Subnet Calculator provides »SynthelicZ« desktop users with a fast, interactive tool for computing IPv4 network properties and visualizing subnet boundaries. It eliminates the need to manually compute network addresses, broadcast addresses, and host ranges, and its interactive binary bit view makes it an effective teaching tool for understanding how subnet masks work at the bit level.

### Key Capabilities
- Instant IPv4 subnet computation showing network address, broadcast, host range, usable hosts, wildcard mask, IP class, and IP type
- Interactive binary representation with clickable bits for toggling the CIDR boundary
- Quick-select bar for common CIDR prefix lengths (/8 through /32)
- Subnet division tables splitting the current network into 2 to 256 equal sub-subnets
- Real-time input synchronization between CIDR prefix and subnet mask fields
- Hex and integer IP representations with IP class and type detection (Private, Public, Loopback, Link-Local, Multicast, Reserved)
- Clipboard export of all calculation results

### Design Reference
Modeled after classic network administrator utilities such as SolarWinds Subnet Calculator and the Advanced Subnet Calculator, with the addition of an interactive binary bit view for educational visualization.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Calculation
- [x] As a user, I can enter an IPv4 address and see all network properties calculated instantly
- [x] As a user, I can enter a CIDR prefix length and see the corresponding subnet mask
- [x] As a user, I can enter a subnet mask and see the corresponding CIDR prefix length
- [x] As a user, I can see the network address for the given IP and mask
- [x] As a user, I can see the broadcast address for the subnet
- [x] As a user, I can see the first and last usable host addresses
- [x] As a user, I can see the total number of addresses in the subnet
- [x] As a user, I can see the number of usable host addresses
- [x] As a user, I can see the wildcard mask
- [x] As a user, I can see the IP class (A, B, C, D, E)
- [x] As a user, I can see the IP type (Private, Public, Loopback, Link-Local, Multicast, Reserved)
- [x] As a user, I can see the hexadecimal representation of the IP address
- [x] As a user, I can see the integer representation of the IP address
- [x] As a user, I can see correct handling of /31 and /32 special subnets

### Binary Representation
- [x] As a user, I can see the binary representation of the IP address, mask, network, and broadcast
- [x] As a user, I can see network bits visually distinguished from host bits
- [x] As a user, I can click on individual mask bits to toggle the CIDR boundary
- [x] As a user, I can see bits organized into 4 octets for readability

### Quick CIDR Selection
- [x] As a user, I can click quick-select buttons for common CIDR values (/8, /16, /24, /25, /26, /27, /28, /29, /30, /31, /32)
- [x] As a user, I can see the currently active CIDR highlighted in the quick-select bar

### Subnet Division
- [x] As a user, I can divide the current subnet into 2, 4, 8, 16, 32, 64, 128, or 256 subnets
- [x] As a user, I can see a table showing each sub-subnet's network, broadcast, host range, and host count
- [x] As a user, I can see an error message when the division exceeds /32

### Input Synchronization
- [x] As a user, I can have the CIDR input automatically update the mask input and vice versa
- [x] As a user, I can see all results update in real-time as I type
- [x] As a user, I can see invalid IP addresses visually marked as invalid

### Copy and Export
- [x] As a user, I can copy all calculation results to the clipboard with Ctrl+Shift+C
- [x] As a user, I can copy results via the Edit menu

### User Interface
- [x] As a user, I can see the IP class in the status bar
- [x] As a user, I can see the IP type in the status bar
- [x] As a user, I can see whether the input is valid in the status bar
- [x] As a user, I can use a menu bar with Edit and Help menus
- [x] As a user, I can see an About dialog

### Aspirational Features
- [ ] As a user, I want IPv6 subnet calculation support
- [ ] As a user, I want to see a visual representation of subnet utilization as a bar or pie chart
- [ ] As a user, I want to check if a specific IP address falls within a given subnet
- [ ] As a user, I want to see the VLSM (Variable Length Subnet Masking) planner for dividing a network into subnets of different sizes
- [ ] As a user, I want to see a supernet/aggregation calculator that combines multiple subnets
- [ ] As a user, I want to save and load subnet configurations to/from files
- [ ] As a user, I want to see a visual subnet map showing all subnets in a network as colored blocks
- [ ] As a user, I want to convert between IP address formats (decimal, hex, binary, octal)
