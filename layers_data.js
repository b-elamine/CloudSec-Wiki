

const LAYERS = [

  // ════════════════════════════════════════════════════════════
  //  LAYER 1 — Compute & Virtualization Security
  // ════════════════════════════════════════════════════════════
  {
    id:          "layer1",
    title:       "1",
    subtitle:    "Compute & Virtualization Security",
    headerLabel: "Cloud Security Category :",
    description: "A deep reference for each attack class: what it is, how it works mechanically, how defenses work and why they fall short, and where dynamic orchestration research opens up. All claims are linked to primary sources.",

    attacks: [

      // ──────────────────────────────────────────────────────
      //  ATTACK 1 — VM Escape
      // ──────────────────────────────────────────────────────
      {
        // Sidebar nav
        navTitle: "VM Escape",
        navSub:   "VENOM · CVE-2015-3456\nQEMU / KVM boundary",

        // Panel header
        badge:      "Pure Layer 1",
        badgeStyle: "l1",          // "l1" (blue) | "mixed" (amber)
        title:      "VM Escape",
        cve:        'KEY EXAMPLE → CVE-2015-3456 "VENOM" · QEMU Floppy Disk Controller overflow',

        // ── Background section ─────────────────────────────
        background: {
          tag: "Background — what is a VM boundary?",
          paragraphs: [
            "A virtual machine is supposed to be completely isolated from the host and from other VMs. The <strong>hypervisor</strong> (software like KVM, Xen, VMware ESXi) creates this isolation by intercepting every hardware operation a guest OS tries to do. When a guest says \"write to disk,\" it doesn't touch real hardware — the hypervisor intercepts the request and emulates the response.",
            "This emulation layer is the attack surface. The hypervisor has to emulate dozens of virtual devices — virtual network cards, virtual storage controllers, virtual USB ports. Each emulated device is code. Code has bugs. A bug in a device emulator can let a guest overwrite memory outside its allocated region — including memory that belongs to the hypervisor process running on the host.",
          ],
          callout: {
            color: "red",
            html:  "<strong>The core danger:</strong> The QEMU process that emulates device hardware runs on the host with elevated privileges. If an attacker inside a guest VM can corrupt QEMU's memory or hijack its execution, they are now running arbitrary code on the host — outside any VM boundary. Every other VM on that host is now exposed.",
          },
        },

        // ── Mechanism section ──────────────────────────────
        mechanism: {
          tag:   "How VENOM works — step by step",
          intro: "VENOM (CVE-2015-3456) exploited a bug in the QEMU virtual floppy disk controller (FDC). Most VMs don't use a floppy drive, but QEMU enabled the FDC emulator by default.",
          steps: [
            "<strong>The attacker is inside a guest VM</strong> and has guest OS-level access (a normal unprivileged user, or a compromised application inside the VM).",
            "<strong>They write to the FDC I/O port</strong> (<code>0x3F5</code>), which is a standard PC I/O port. Even unprivileged guest code can trigger this on some hypervisor configurations.",
            "<strong>The FDC handler in QEMU has a command FIFO buffer</strong> of fixed size. QEMU never reset this buffer between certain commands. An attacker can keep writing FDC commands to overflow it.",
            "<strong>The overflow corrupts QEMU's heap</strong> on the host. QEMU is a userspace process — its heap is just memory on the host. Corrupting it is a standard heap overflow exploit.",
            "<strong>With a controlled heap overflow</strong>, the attacker crafts a payload that redirects QEMU's execution to shellcode. They now run code as the QEMU process on the host.",
            "<strong>The QEMU process has host-level privileges</strong> and can read/write the memory of other VMs, escalate to root, exfiltrate data from the host filesystem, or pivot to other machines on the host network.",
          ],
          callout: {
            color: "amber",
            html:  "<strong>Why this is serious at scale:</strong> In a cloud environment, one physical host runs dozens of customer VMs. VENOM meant any customer who could run code in their own VM could escape and access every other customer's VM on the same host. AWS, Rackspace, DigitalOcean, and Linode all issued emergency patches within 24 hours of disclosure.",
          },
        },

        // ── Defenses section ───────────────────────────────
        defenses: {
          tag: "Defenses and how they work",
          items: [
            {
              name: "Patching the emulator",
              desc: "The immediate fix was to add a bounds check to the FDC FIFO buffer. QEMU 2.3.0 and patched versions of KVM/QEMU were released within hours. This is reactive — it works only after the bug is known.",
            },
            {
              name: "Device emulator sandboxing (seccomp + privilege separation)",
              desc: "Modern QEMU runs device emulators in a restricted sandbox using Linux <code>seccomp</code> — a kernel feature that limits which system calls a process can make. Even if an attacker overflows the QEMU heap, the shellcode they run can't do much because the process can't call <code>execve()</code>, <code>fork()</code>, or open network sockets. This limits blast radius even when the escape succeeds.",
            },
            {
              name: "Virtual Machine Introspection (VMI)",
              desc: "VMI tools like <strong>DRAKVUF</strong> and <strong>LibVMI</strong> run at the hypervisor level — below the guest OS — and observe guest memory, CPU register state, and system call activity without being visible to the guest. They can detect anomalous I/O port activity (a guest hammering the FDC port with unexpected byte sequences) and flag it before the overflow succeeds.",
            },
            {
              name: "Microkernel VMM architecture",
              desc: "Hypervisors like <strong>seL4</strong> and disaggregated <strong>Xen</strong> run each device driver in a separate isolated domain. Compromising the FDC emulator doesn't give you access to the hypervisor core or other domains — there's no shared memory to corrupt. This is a structural defense rather than a patch.",
            },
          ],
        },

        // ── Gaps section ───────────────────────────────────
        gaps: {
          tag: "Why defenses are insufficient — the open problem",
          items: [
            {
              label: "Gap 1 — Reactive patching",
              text:  "Every patch requires a known CVE. Between when a vulnerability is introduced and when it's patched, cloud providers are blind. For VENOM, the bug existed in QEMU since 2004 — 11 years of exposure. Future bugs of this class exist right now in device emulators.",
            },
            {
              label: "Gap 2 — VMI detects but doesn't respond",
              text:  "DRAKVUF can detect anomalous FDC access patterns, but its job ends at generating an alert. The decision to live-migrate the VM, pause it, reduce its I/O privileges, or terminate it is still made manually by a human operator. In the time between alert and human response, the exploit may complete.",
            },
            {
              label: "Gap 3 — No behavioral baseline",
              text:  "There is no standard mechanism for saying \"this VM is expected to do X, Y, Z with its virtual devices — any deviation should trigger a graduated response.\" The hypervisor has no concept of a VM's normal behavioral contract.",
            },
          ],
          research: "If you could define a behavioral contract for a VM at provisioning time — what device I/O patterns are normal for a web server vs. a database vs. a compute workload — and continuously check that contract at the hypervisor layer, you could close the gap between detection and automated response. The VMI signal pipeline already exists (DRAKVUF). What doesn't exist is the policy layer above it that drives automatic action.",
        },

        // ── References section ─────────────────────────────
        references: [
          {
            num:        1,
            title:      "VENOM: Virtualized Environment Neglected Operations Manipulation",
            authors:    "Jason Geffner, CrowdStrike",
            venue:      "CrowdStrike Research Blog, May 2015",
            url:        "https://venom.crowdstrike.com",
            annotation: "Original disclosure. Contains the CVE analysis, affected systems list, and proof-of-concept description. Start here.",
          },
          {
            num:        2,
            title:      "DRAKVUF: Stealthy Observation System",
            authors:    "Tamas K Lengyel",
            venue:      "IEEE Security & Privacy Workshop on Offensive Technologies (WOOT), 2014",
            url:        "https://drakvuf.com",
            annotation: "The primary VMI framework for hypervisor-level monitoring. Understand this before building any detection layer.",
          },
          {
            num:        3,
            title:      "Ren et al., \"Breaking Isolation: A New Perspective on Hypervisor Exploitation via Cross-Domain Attacks\"",
            authors:    "Ren et al.",
            venue:      "arXiv, 2025",
            annotation: "Most recent (2025) framing of VM escape as a cross-domain problem — the attacker pivots across trust boundaries. Directly relevant to your thesis framing.",
          },
          {
            num:        4,
            title:      "Chen et al., \"HyperHammer: Breaking Free from KVM-Enforced Isolation\"",
            authors:    "Chen et al.",
            venue:      "ASPLOS, 2025",
            annotation: "2025 attack on KVM isolation using hardware-level abuse. Shows that even a well-maintained hypervisor is breakable via hardware semantics, not just software bugs.",
          },
          {
            num:        5,
            title:      "Garfinkel & Rosenblum, \"A Virtual Machine Introspection Based Architecture for Intrusion Detection\"",
            authors:    "Tal Garfinkel, Mendel Rosenblum",
            venue:      "NDSS, 2003",
            annotation: "The foundational VMI paper. Defines the concept of monitoring a VM from outside its boundary. Mandatory reading for any Layer 1 detection work.",
          },
        ],
      },

      // ──────────────────────────────────────────────────────
      //  ATTACK 2 — Cross-VM Side-Channel
      // ──────────────────────────────────────────────────────
      {
        navTitle: "Side-Channel",
        navSub:   "Prime+Probe · Flush+Reload\nShared CPU cache",

        badge:      "Pure Layer 1",
        badgeStyle: "l1",
        title:      "Cross-VM Side-Channel",
        cve:        "KEY EXAMPLES → Prime+Probe · Flush+Reload · CacheBleed (2016) · Spectre/Meltdown (2018)",

        background: {
          tag: "Background — what is a side channel?",
          paragraphs: [
            "A <strong>side channel</strong> is information that leaks from a computation not through its intended output, but through a physical or temporal side effect — how long it takes, how much power it uses, how it affects shared hardware. Side-channel attacks extract secrets without ever touching the secret directly.",
            "In cloud environments, the critical shared resource is the <strong>CPU cache</strong>. Modern CPUs have a hierarchy of caches (L1, L2, L3). The L3 cache (last-level cache, LLC) is shared across all cores on a physical chip — meaning two VMs running on different cores of the same CPU share L3. This sharing is what makes cross-VM cache side-channel attacks possible: one VM can observe how another VM uses the shared cache, and from those observations, reconstruct the other VM's memory access patterns — and from those patterns, extract cryptographic keys.",
          ],
          callout: {
            color: "red",
            html:  "<strong>What makes this dangerous:</strong> No hypervisor bug is required. The hypervisor is working correctly. The attack exploits fundamental CPU hardware architecture that was designed for performance, not security. You cannot patch the CPU design.",
          },
        },

        mechanism: {
          tag:   "How Prime+Probe works — step by step",
          intro: "Prime+Probe is the foundational cache side-channel technique. It works in two phases that repeat thousands of times:",
          steps: [
            "<strong>Attacker and victim VM are co-located</strong> on the same physical CPU chip — a normal outcome of cloud VM placement for efficiency. They share the L3 cache.",
            "<strong>PRIME phase:</strong> The attacker VM fills specific cache sets with its own data by accessing a carefully crafted memory pattern. After this, every cache line in the targeted cache sets contains attacker data. The attacker knows exactly which cache lines are \"owned.\"",
            "<strong>The victim VM runs a sensitive operation</strong> — for example, RSA private key decryption using OpenSSL. The decryption algorithm accesses memory locations that depend on the bits of the private key.",
            "<strong>The victim's memory accesses evict the attacker's cache lines</strong> from the sets the victim accessed. The cache has limited space; when the victim loads its data, it displaces attacker data.",
            "<strong>PROBE phase:</strong> The attacker re-accesses all the cache lines it placed during Prime and measures how long each access takes. A fast access means the attacker's data is still in cache (the victim didn't touch that cache set). A slow access means the victim evicted it (the victim accessed memory that maps to that cache set).",
            "<strong>The access time pattern reveals which cache sets the victim used</strong>, which reveals which memory addresses the victim accessed, which reveals the private key bit pattern used during decryption.",
            "<strong>Repeat thousands of times</strong> to statistically recover the full key. CacheBleed recovered a 2048-bit RSA key in under an hour from a co-resident VM.",
          ],
          callout: {
            color: "amber",
            html:  "<strong>Flush+Reload</strong> is a variant requiring shared memory pages (possible when VMs share libraries like OpenSSL). The attacker flushes a cache line, waits for the victim to potentially use it, then measures reload time. More precise than Prime+Probe because it targets exact memory addresses rather than cache sets.",
          },
        },

        defenses: {
          tag: "Defenses and how they work",
          items: [
            {
              name: "Intel CAT — Cache Allocation Technology",
              desc: "Intel CAT (available on Xeon processors from ~2016) lets software partition the L3 cache into separate regions. You can configure the hypervisor so VM A only uses cache ways 0–7 and VM B only uses cache ways 8–15. The VMs no longer share any cache lines, so Prime+Probe has no signal to read. The limitation: CAT partitioning is configured at VM placement time — a static decision.",
            },
            {
              name: "Cache noise injection",
              desc: "Add random timing delays to memory operations inside VMs. If the victim's cache access pattern is buried in noise, the attacker's timing measurements become unreliable. Problem: enough noise to defeat the attack also noticeably degrades performance. Commercial cloud providers cannot afford 10–30% performance penalties.",
            },
            {
              name: "CPU pinning and strict co-location policy",
              desc: "Never schedule a sensitive VM (e.g., one handling cryptographic keys) on the same physical CPU as an untrusted tenant. Implemented as a placement constraint in cloud orchestrators (OpenStack, Kubernetes). The problem: the scheduler has no way to know which tenants are \"untrusted\" or which workloads are \"sensitive\" at runtime.",
            },
            {
              name: "Constant-time cryptographic implementations",
              desc: "Rewrite cryptographic operations so their memory access patterns don't depend on secret data. If every RSA decryption accesses exactly the same memory addresses regardless of the key value, there's no signal for the attacker to observe. Modern OpenSSL and BoringSSL have adopted constant-time implementations for this reason.",
            },
          ],
        },

        gaps: {
          tag: "Why defenses are insufficient",
          items: [
            {
              label: "Gap 1 — Static placement, dynamic threat",
              text:  "CAT partitioning and CPU pinning are decided when a VM is first placed. But the threat model changes at runtime: a new tenant arrives and is co-located, an existing workload changes from batch processing to cryptographic operations, or an attacker VM gradually increases its cache probing activity. There is no mechanism that continuously reassesses co-location risk and dynamically triggers re-partitioning or live migration.",
            },
            {
              label: "Gap 2 — No detection of probing behavior",
              text:  "Prime+Probe requires the attacker VM to perform a highly distinctive pattern of memory accesses — systematically filling and re-reading cache sets in a tight loop. This pattern is, in principle, detectable from hardware performance counters (PMU events like <code>LLC_MISSES</code>, <code>LLC_LOADS</code>). But no current system monitors these counters per-VM at the hypervisor level and acts on anomalies.",
            },
          ],
          research: "Hardware performance counters (Intel PMU) are accessible from the hypervisor and can be read per-vCPU. An orchestration layer that continuously monitors <code>LLC_MISSES</code> per VM and detects the characteristic fill-probe pattern of side-channel attacks could trigger a co-location response — migrating the potential victim or re-partitioning the cache — before significant key material is leaked.",
        },

        references: [
          {
            num:        6,
            title:      "Liu et al., \"Last-Level Cache Side-Channel Attacks are Practical\"",
            authors:    "Fangfei Liu, Yuval Yarom, Qian Ge, Gernot Heiser, Ruby Lee",
            venue:      "IEEE S&P (Oakland), 2015",
            annotation: "Foundational Prime+Probe paper showing LLC side-channel attacks are practical across VMs. The core technical reference for this attack class.",
          },
          {
            num:        7,
            title:      "Yarom & Falkner, \"FLUSH+RELOAD: A High Resolution, Low Noise, L3 Cache Side-Channel Attack\"",
            authors:    "Yuval Yarom, Katrina Falkner",
            venue:      "USENIX Security, 2014",
            annotation: "The Flush+Reload technique. More precise than Prime+Probe. Essential for understanding the full attack family.",
          },
          {
            num:        8,
            title:      "CacheBleed: A Timing Attack on OpenSSL Constant-Time RSA",
            authors:    "Yuval Yarom, Daniel Genkin, Nadia Heninger",
            venue:      "Journal of Cryptographic Engineering, 2017",
            annotation: "Demonstrates cross-VM RSA key extraction. The most concrete proof that these attacks work in real cloud environments.",
          },
          {
            num:        9,
            title:      "Kocher et al., \"Spectre Attacks: Exploiting Speculative Execution\"",
            authors:    "Paul Kocher et al.",
            venue:      "IEEE S&P, 2019",
            annotation: "Spectre extends the side-channel concept by exploiting CPU speculative execution — a different mechanism but the same fundamental problem: hardware designed for performance leaks secrets.",
          },
          {
            num:        10,
            title:      "Intel Cache Allocation Technology (CAT) — Specification",
            authors:    "Intel Corporation",
            venue:      "Intel Architecture Software Developer Manual, Vol. 3B, 2016",
            annotation: "Technical specification for Intel CAT. Required reading to understand what the hardware mitigation actually provides and its limits.",
          },
        ],
      },

      // ──────────────────────────────────────────────────────
      //  ATTACK 3 — VM Rollback
      // ──────────────────────────────────────────────────────
      {
        navTitle: "VM Rollback",
        navSub:   "Snapshot replay\nTPM & attestation",

        badge:      "Pure Layer 1",
        badgeStyle: "l1",
        title:      "VM Rollback Attack",
        cve:        "KEY MECHANISM → Hypervisor snapshot restoration abused to replay revoked credentials and bypass patches",

        background: {
          tag: "Background — what is VM state and why does rolling back matter?",
          paragraphs: [
            "A VM's complete state at any moment — its RAM contents, CPU register values, virtual disk contents, and network configuration — can be captured as a <strong>snapshot</strong>. Snapshots are a legitimate, essential feature: they enable live migration, backup, disaster recovery, and cloud scaling. Every major hypervisor (KVM, VMware, Hyper-V, Xen) supports them.",
            "The security problem is that <strong>restoring a snapshot makes the VM believe it's living in the past</strong>. The VM's clock, its cryptographic keys, its patch level, its session tokens, its credential stores — all reset to their state at snapshot time. If the snapshot predates a security event (key rotation, patch deployment, password change), restoring it undoes that security event.",
          ],
          callout: {
            color: "red",
            html:  "<strong>Who can perform a rollback?</strong> Anyone with hypervisor-level access: a cloud provider admin, a compromised management plane, a malicious insider, or an attacker who has already escalated to hypervisor level via another attack. This is why VM rollback is often a second-stage attack — it follows an initial hypervisor compromise.",
          },
        },

        mechanism: {
          tag:   "How a rollback attack works — concrete scenario",
          intro: "Scenario: a key management VM handles TLS private keys for a cloud service. The attack unfolds as follows:",
          steps: [
            "<strong>Day 0 — Snapshot taken:</strong> The infrastructure takes a routine backup snapshot of the VM. At this point, the VM holds TLS private key K1 and session token S1.",
            "<strong>Day 7 — Security incident detected:</strong> A potential compromise is detected. The security team rotates TLS keys (K1 → K2) and revokes all active session tokens. The attacker's access appears to be cut off.",
            "<strong>Day 7, 1 hour later — The attacker is still in the hypervisor layer</strong> (or returns via a separate hypervisor vulnerability). They restore the Day 0 snapshot.",
            "<strong>The VM is now back in its Day 0 state:</strong> It is running with old key K1, has session token S1 active, and is not patched for any vulnerabilities fixed between Day 0 and Day 7. From the VM's perspective, the key rotation never happened.",
            "<strong>The attacker uses K1 to decrypt previously captured TLS traffic</strong> they recorded before the key rotation. The traffic is now decryptable because the key has been \"unrevoked.\"",
            "<strong>The VM also re-negotiates connections</strong> using K1 — so any service that previously accepted K1 (if revocation checks are imperfect) will continue to work.",
          ],
          callout: null,
        },

        defenses: {
          tag: "Defenses and how they work",
          items: [
            {
              name: "TPM sealed storage",
              desc: "A <strong>Trusted Platform Module (TPM)</strong> is a hardware security chip that can store secrets in a way that's bound to the system's software state. Keys sealed to TPM state are only accessible when the system boots into a specific, expected configuration (measured by boot-time hashes). If you roll back the VM, the TPM state also reverts — and the reverted TPM can't unseal the new keys (K2) because it only knows about K1. This makes rollback attacks against properly sealed keys very difficult.",
            },
            {
              name: "Monotonic counters",
              desc: "A counter that only ever increments, stored in tamper-resistant hardware. You embed the current counter value into VM state. On restore, if the counter value in the snapshot is less than the current hardware counter value, the VM knows it has been rolled back and can refuse to continue. Intel SGX and TPM 2.0 both support monotonic counters.",
            },
            {
              name: "Snapshot integrity logs with timestamps",
              desc: "Every snapshot operation is cryptographically logged with a timestamp and a hash of the VM state. The chain of logs makes unauthorized or unexpected rollback events visible to auditors — but not in real time, and only after the fact.",
            },
            {
              name: "Remote attestation at boot/join time",
              desc: "Before the VM is allowed to join a network or access sensitive resources, it must prove its software state to a remote attestation server. If the VM was rolled back, its measured state won't match the expected current state and the attestation will fail. The problem: attestation is checked at join time, not continuously.",
            },
          ],
        },

        gaps: {
          tag: "Why defenses are insufficient",
          items: [
            {
              label: "Gap 1 — Attestation is point-in-time",
              text:  "Remote attestation verifies state at boot or network join. A VM that passes attestation at 9am and is then rolled back at 10am will not be re-attested until the next reboot or policy-triggered check. The window between attestation events is blind.",
            },
            {
              label: "Gap 2 — The hypervisor can lie",
              text:  "If the attacker controls the hypervisor, they can intercept and spoof attestation responses. Traditional TPM-based attestation assumes the hypervisor is trusted. AMD SEV-SNP and Intel TDX address this with hardware-rooted isolation, but deployment is still limited.",
            },
            {
              label: "Gap 3 — Snapshot operations are not anomaly-detected",
              text:  "The hypervisor generates an event every time a snapshot is taken or restored. No current system treats an unexpected snapshot restoration as a security signal requiring automated response — it's treated as a routine operational event.",
            },
          ],
          research: "The hypervisor already knows when a snapshot restoration occurs — it's a hypervisor API call. An orchestration layer that subscribes to these events and triggers immediate re-attestation (or VM suspension) on any unexpected restoration could close the window that currently exists between rollback and detection. The policy question is: which snapshot restorations are \"expected\" (legitimate backup restore) vs. \"anomalous\" (post-incident rollback)? That's a modeling problem with MDE-relevant structure.",
        },

        references: [
          {
            num:        11,
            title:      "Trusted Platform Module Library Specification, Family \"2.0\"",
            authors:    "Trusted Computing Group (TCG)",
            venue:      "TCG Specification, 2016 (rev. 1.59, 2023)",
            url:        "https://trustedcomputinggroup.org/resource/tpm-library-specification/",
            annotation: "The authoritative specification for TPM 2.0 including sealed storage and monotonic counters. Technical but necessary for understanding what the hardware defense actually guarantees.",
          },
          {
            num:        12,
            title:      "Szefer & Lee, \"Architectural Support for Hypervisor-Secure Virtualization\"",
            authors:    "Jakub Szefer, Ruby B. Lee",
            venue:      "ASPLOS, 2012",
            annotation: "Proposes hardware changes to prevent even a compromised hypervisor from accessing VM memory or state. Defines the architectural threat model you need when analyzing rollback attacks.",
          },
          {
            num:        13,
            title:      "AMD SEV-SNP: Strengthening VM Isolation with Integrity Protection and More",
            authors:    "AMD Corporation",
            venue:      "AMD White Paper, 2020",
            url:        "https://www.amd.com/system/files/TechDocs/SEV-SNP-strengthening-vm-isolation-with-integrity-protection-and-more.pdf",
            annotation: "AMD's hardware-level solution providing VM memory integrity protection and replay protection — directly relevant to rollback attack mitigations.",
          },
        ],
      },

      // ──────────────────────────────────────────────────────
      //  ATTACK 4 — Malicious VM Image Injection
      // ──────────────────────────────────────────────────────
      {
        navTitle: "VM Image Injection",
        navSub:   "Trojanized AMI / qcow2\nSupply chain at Layer 1",

        badge:      "Layer 1 — VM disk images (not containers)",
        badgeStyle: "l1",
        title:      "Malicious VM Image Injection",
        cve:        "KEY EXAMPLES → Poisoned AMIs in AWS Marketplace · Backdoored OpenStack Glance images · QCOW2 supply chain",

        background: {
          tag: "Important — Layer 1 vs Layer 5 distinction",
          paragraphs: [
            "This attack class exists at multiple layers and it's easy to confuse them. Here is the precise distinction:",
          ],
          // Optional two-column comparison cards
          cards: [
            {
              title:      "Layer 1 version",
              titleColor: "blue",
              text:       "A malicious <strong>VM disk image</strong> — a full virtual machine image file (<code>.qcow2</code>, <code>.vmdk</code>, <code>.vhd</code>, or an AWS AMI). This is a complete bootable OS with added malicious components at the hypervisor storage level. The attack surface is the image format parser and the hypervisor's image loading pipeline.",
            },
            {
              title:      "Layer 5 version (not here)",
              titleColor: "amber",
              text:       "A malicious <strong>container image</strong> — a Docker/OCI image in a registry like Docker Hub. This is application-layer code packaged in layers. The attack surface is the container runtime and registry trust. This is a Layer 5 problem because it concerns application deployment infrastructure, not the hypervisor.",
            },
          ],
          callout: {
            color: "amber",
            html:  "<strong>Why this matters for your research:</strong> The Layer 1 version is underexplored compared to the container supply chain problem. Most academic attention goes to container security. VM disk image supply chain security at the hypervisor level — especially runtime behavioral detection after image instantiation — is a genuine gap.",
          },
        },

        mechanism: {
          tag:   "How VM image injection works at Layer 1",
          intro: "The attack targets the VM image supply chain — how organizations obtain base VM images for their cloud deployments:",
          steps: [
            "<strong>Organizations source base VM images</strong> from public marketplaces (AWS Marketplace, OpenStack community image repository, QEMU image catalog) rather than building their own. This is common practice because building and maintaining OS images is expensive.",
            "<strong>An attacker publishes a malicious image</strong> that appears to be a legitimate OS (Ubuntu 22.04, CentOS, Windows Server). The image contains the genuine OS but with additions: a persistent backdoor in an init script, a kernel module rootkit, a credential harvester, or a cryptominer that only activates after a delay.",
            "<strong>The malicious image is difficult to distinguish</strong> from a legitimate one by inspection. The image passes basic hash checks (the hash matches the one the attacker published). It may even pass virus scans if the payload is obfuscated.",
            "<strong>When the VM is instantiated</strong>, the hypervisor boots the image. The malicious components run from first boot, inside what appears to be a legitimate workload.",
            "<strong>The malicious payload operates below the application layer</strong> — it may be a modified kernel module, a hijacked init process, or a UEFI-level implant baked into the image. Applications running inside the VM are unaware.",
            "<strong>From the hypervisor's perspective</strong>, this VM looks normal — it's running a valid OS image. The malicious behavior only becomes apparent from behavioral signals: unusual network connections, unexpected process spawning, anomalous system call patterns.",
          ],
          callout: null,
        },

        defenses: {
          tag: "Defenses and how they work",
          items: [
            {
              name: "Hash-based image attestation",
              desc: "Compute a cryptographic hash (SHA-256) of the entire VM image before deployment and compare it against a known-good hash from a trusted source. This detects tampering with an image after publication — but only if you trust the source of the known-good hash. It cannot detect malicious content that was there when the hash was first computed.",
            },
            {
              name: "Image scanning before instantiation",
              desc: "Tools like <strong>Trivy</strong>, <strong>OpenSCAP</strong>, and commercial offerings scan VM images for known CVEs, malware signatures, and policy violations before the image is booted. Limitation: signature-based scanning only catches known malware. Novel payloads, obfuscated code, and logic bombs that activate on specific conditions are typically missed.",
            },
            {
              name: "Measured boot and UEFI Secure Boot",
              desc: "The boot process is measured — each stage (firmware, bootloader, kernel, init) is hashed and recorded in TPM PCR registers. The resulting measurement chain is compared against expected values. A backdoored init script will produce a different measurement than the clean image. This is effective for detecting modifications to measured boot components.",
            },
            {
              name: "Private image repositories with governance",
              desc: "Organizations maintain their own internal image registries seeded from trusted sources, apply scanning before admission, and sign images with their own keys. Only images that have passed the internal pipeline are allowed to run. This reduces but doesn't eliminate the risk — the organization's build pipeline itself becomes the trust anchor.",
            },
          ],
        },

        gaps: {
          tag: "Why defenses are insufficient",
          items: [
            {
              label: "Gap 1 — Pre-boot checks don't cover runtime behavior",
              text:  "Hash verification and image scanning are pre-instantiation checks. They say \"this image matches what was signed\" or \"this image has no known malware signatures.\" They say nothing about what the running VM will do. A signed, scanned image can contain a logic bomb that activates 72 hours after first boot or when it detects certain environment variables present in the cloud metadata service.",
            },
            {
              label: "Gap 2 — No behavioral baseline for image classes",
              text:  "When you boot a \"Ubuntu 22.04 web server\" image, there's no standard specification of what system calls, network patterns, or file access patterns that VM should exhibit in its first hour of operation. Without a baseline, you can't define \"anomalous\" behavior — you can only react to known-bad signatures.",
            },
            {
              label: "Gap 3 — The hypervisor sees behavior but doesn't interpret it",
              text:  "The hypervisor intercepts every system call, every I/O operation, every network packet from a newly booted VM. It has perfect visibility. But no current system uses this visibility to automatically profile and classify newly booted VM behavior against an expected behavioral model for that image type.",
            },
          ],
          research: "A VM image class can have an associated behavioral specification — a model of what normal first-boot behavior looks like (which processes spawn, which network connections are made, which kernel modules load). The hypervisor, via VMI, can monitor a newly instantiated VM against this model. Deviation within the first N minutes triggers quarantine. This is a Layer 1 problem because the monitoring happens at the hypervisor level, below the guest OS, and the behavioral signals come from hypervisor-level instrumentation — not from agents inside the VM.",
        },

        references: [
          {
            num:        14,
            title:      "Bulekov et al., \"HyperPill: Fuzzing for Hypervisor-bugs by Leveraging the Hardware Virtualization Interface\"",
            authors:    "Alexander Bulekov et al.",
            venue:      "USENIX Security, 2024",
            annotation: "Relevant because it shows the hypervisor's hardware virtualization interface is a rich source of observable signals — the same interface that exposes attack behavior also exposes it for detection.",
          },
          {
            num:        15,
            title:      "NIST SP 800-190: Application Container Security Guide",
            authors:    "NIST",
            venue:      "NIST Special Publication, 2017",
            url:        "https://csrc.nist.gov/publications/detail/sp/800-190/final",
            annotation: "While focused on containers, section 3.1 on image vulnerabilities applies equally to VM images. Useful for understanding the supply chain trust problem that exists at both layers.",
          },
          {
            num:        16,
            title:      "Pfoh et al., \"Nitro: Hardware-based System Call Tracing for Virtual Machines\"",
            authors:    "Jonas Pfoh, Christian Schneider, Claudia Eckert",
            venue:      "ACNS, 2011",
            annotation: "Shows how to extract system call traces from a VM at the hypervisor level using hardware virtualization events. This is the monitoring primitive you would use to build behavioral baselining for new VM instances.",
          },
        ],
      },

      // ──────────────────────────────────────────────────────
      //  ATTACK 5 — Blue Pill Hypervisor Rootkit
      // ──────────────────────────────────────────────────────
      {
        navTitle: "Blue Pill Rootkit",
        navSub:   "LoJax · SubVirt\nBelow-OS hypervisor",

        badge:      "Pure Layer 1 — below the OS",
        badgeStyle: "l1",
        title:      "Blue Pill Hypervisor Rootkit",
        cve:        "KEY EXAMPLES → Blue Pill (Rutkowska, 2006) · SubVirt (King & Chen, 2006) · LoJax UEFI implant (APT28, 2018)",

        background: {
          tag: "Background — what does \"below the OS\" mean?",
          paragraphs: [
            "A normal rootkit hides inside the operating system — it modifies kernel code, hooks system calls, hides processes. Security tools running in the same OS can (with effort) find it. A <strong>hypervisor rootkit</strong> takes this to the next level: it moves the entire operating system into a virtual machine and runs below it, at the hardware virtualization layer.",
            "Modern CPUs have two distinct execution modes for virtualization: <strong>VMX root mode</strong> (the hypervisor, with full hardware control) and <strong>VMX non-root mode</strong> (the guest OS, with restricted hardware access). A Blue Pill rootkit takes VMX root mode for itself, demotes the victim OS to VMX non-root mode, and operates completely outside any visibility that the OS has.",
          ],
          callout: {
            color: "red",
            html:  "<strong>Why this is fundamentally different from other attacks:</strong> Every security tool that runs in the OS — antivirus, EDR, integrity checkers, log collectors — is now inside the attacker's VM. The attacker can intercept, modify, or fabricate any output from these tools. The system reports itself as clean because the attacker controls what \"clean\" means at the lowest observable level.",
          },
        },

        mechanism: {
          tag:   "How Blue Pill works — step by step",
          intro: null,
          steps: [
            "<strong>Attacker gains initial OS-level access</strong> — could be any vulnerability: a web app exploit, a phishing attack leading to malware execution, a compromised admin account. They need enough privilege to load a kernel module.",
            "<strong>The attacker loads a malicious kernel module</strong> that contains a minimal hypervisor. Modern CPUs (Intel VT-x, AMD-V) allow software to enter VMX root mode by executing the <code>VMXON</code> instruction — but this requires kernel-level privilege.",
            "<strong>The malicious hypervisor captures the current OS state</strong> — registers, memory map, running processes, everything — and constructs a VM descriptor (VMCS on Intel) that represents the current OS state as a guest VM configuration.",
            "<strong>It executes <code>VMLAUNCH</code></strong>, which transitions the CPU into VMX non-root mode and resumes the OS as a guest. From the OS's perspective, nothing happened — execution continues with a tiny, imperceptible pause.",
            "<strong>The malicious hypervisor now intercepts all hardware access:</strong> disk reads/writes, network I/O, memory-mapped hardware, BIOS/UEFI calls. It can fake responses to any security query the OS makes.",
            "<strong>The OS is completely unaware it's virtualized.</strong> If the OS queries a hardware register to check whether virtualization is active (e.g., CPUID leaf 1, bit 31 — \"hypervisor present\"), the malicious hypervisor intercepts the query and returns 0. The OS believes it has full hardware access.",
            "<strong>Persistence:</strong> Modern variants (like LoJax) embed themselves in UEFI firmware, so they survive OS reinstallation and even hard drive replacement. The malicious hypervisor reloads from firmware on every boot before the OS starts.",
          ],
          callout: null,
        },

        defenses: {
          tag: "Defenses and how they work",
          items: [
            {
              name: "Secure Boot + UEFI measured boot",
              desc: "UEFI Secure Boot requires every boot component (firmware, bootloader, kernel) to be signed by a trusted key. A Blue Pill rootkit attempting to inject itself into the boot chain would need a signature it doesn't have. Measured boot records each stage's hash in TPM PCR registers — a tampered boot produces a different measurement that remote attestation can detect. This works well against boot-time injection but not against runtime injection after a valid boot.",
            },
            {
              name: "DRTM — Dynamic Root of Trust for Measurement",
              desc: "Intel TXT and AMD SKINIT allow a system to re-establish a hardware-rooted trust measurement at any point during runtime — not just at boot. This involves resetting the CPU to a known clean state and re-measuring the currently running software. A Blue Pill rootkit would be detected because it wasn't present in the original measured boot sequence. The limitation: DRTM is a point-in-time check, not continuous monitoring.",
            },
            {
              name: "AMD SEV-SNP / Intel TDX",
              desc: "AMD Secure Encrypted Virtualization with Secure Nested Paging (SEV-SNP) and Intel Trust Domain Extensions (TDX) provide hardware-enforced VM isolation where <strong>even the hypervisor cannot read or modify guest VM memory</strong>. This inverts the traditional trust model: instead of trusting the hypervisor to protect guests, hardware protects guests from the hypervisor. Against Blue Pill, this means a malicious hypervisor cannot inspect or manipulate the guest's memory — limiting what it can do even if it controls the hardware layer.",
            },
            {
              name: "Timing-based hypervisor detection",
              desc: "A hypervisor adds measurable overhead to certain CPU instructions — particularly <code>CPUID</code>, <code>RDTSC</code>, and <code>RDTSCP</code> which the hypervisor must intercept. By timing these instructions thousands of times, software can detect whether it's running in a VM (unexpected latency spikes indicate hypervisor interception). Blue Pill rootkits try to minimize this overhead, but it can't be eliminated entirely. Limitation: legitimate hypervisors also cause timing anomalies, so false positive rates are high.",
            },
          ],
        },

        gaps: {
          tag: "Why defenses are insufficient",
          items: [
            {
              label: "Gap 1 — Trust chain is still point-in-time",
              text:  "Measured boot produces a snapshot of trust at boot time. Runtime injection (Blue Pill loaded after a valid boot) is not covered. DRTM can detect runtime injection but must be explicitly triggered — it doesn't run continuously. Between DRTM checks, an attacker has a window to operate.",
            },
            {
              label: "Gap 2 — Timing detection is unreliable in production",
              text:  "Cloud environments legitimately run VMs inside hypervisors. Timing-based Blue Pill detection would generate enormous false positives in a cloud environment where every VM is already virtualized. You need to distinguish \"legitimate hypervisor timing anomaly\" from \"malicious nested hypervisor timing anomaly\" — a very hard problem.",
            },
            {
              label: "Gap 3 — SEV/TDX deployment is limited and incomplete",
              text:  "AMD SEV-SNP and Intel TDX are available on recent hardware (2021+) and require guest OS support. Most cloud production environments still run on hardware or hypervisor configurations where these protections are unavailable. The protection they offer also doesn't cover all attack surfaces — they protect memory confidentiality but not all side channels.",
            },
            {
              label: "Gap 4 — No continuous hardware telemetry stream",
              text:  "TPM PCR registers record state at measurement events. There is no existing system that produces a continuous stream of hardware-rooted attestation data that an orchestration layer could monitor for drift. The gap between \"measured at boot\" and \"continuously verified\" is exactly the window Blue Pill exploits.",
            },
          ],
          research: "AMD SEV-SNP exposes measurement registers that could in principle be sampled periodically — not just at boot. An orchestration layer that maintains a time-series of attestation measurements per VM and detects statistical drift (a Blue Pill insertion would cause a discontinuity in the measurement series) could detect runtime injection attacks without relying on OS-level visibility that the rootkit can intercept. The key research question: what sampling frequency is sufficient to detect injection before damage occurs, and what's the performance cost?",
        },

        references: [
          {
            num:        17,
            title:      "Rutkowska, \"Subverting Vista Kernel for Fun and Profit\" (Blue Pill)",
            authors:    "Joanna Rutkowska",
            venue:      "Black Hat USA, 2006",
            url:        "https://www.blackhat.com/presentations/bh-usa-06/BH-US-06-Rutkowska.pdf",
            annotation: "The original Blue Pill presentation. Demonstrates the concept of loading a malicious hypervisor at runtime. Foundational for understanding the attack class.",
          },
          {
            num:        18,
            title:      "King & Chen, \"SubVirt: Implementing Malware with Virtual Machines\"",
            authors:    "Samuel T. King, Peter M. Chen",
            venue:      "IEEE S&P (Oakland), 2006",
            annotation: "Academic companion to Blue Pill. More rigorous analysis of the attack model and the difficulty of detection. Published the same year — read both together.",
          },
          {
            num:        19,
            title:      "ESET, \"LoJax: First UEFI rootkit found in the wild, courtesy of the Sednit group\"",
            authors:    "ESET Research",
            venue:      "ESET White Paper, 2018",
            url:        "https://www.welivesecurity.com/2018/09/27/lojax-first-uefi-rootkit-found-wild-courtesy-sednit-group/",
            annotation: "First documented in-the-wild UEFI rootkit by APT28. Shows the real-world evolution of the Blue Pill concept into persistent firmware implants.",
          },
          {
            num:        20,
            title:      "AMD SEV-SNP: Strengthening VM Isolation with Integrity Protection",
            authors:    "AMD Corporation",
            venue:      "AMD White Paper, 2020",
            url:        "https://www.amd.com/system/files/TechDocs/SEV-SNP-strengthening-vm-isolation-with-integrity-protection-and-more.pdf",
            annotation: "The hardware defense that most directly addresses Blue Pill's ability to read/modify guest memory. Understanding its guarantees and limitations is essential for your orchestration research.",
          },
          {
            num:        21,
            title:      "Wojtczuk & Rutkowska, \"Attacking Intel Trusted Execution Technology\"",
            authors:    "Rafal Wojtczuk, Joanna Rutkowska",
            venue:      "Black Hat DC, 2009",
            annotation: "Shows limits of Intel TXT (DRTM) against determined attackers. Important for understanding why hardware trust anchors are necessary but not sufficient without an orchestration layer above them.",
          },
        ],
      },

    ], // end attacks
  }, // end layer1

  // ════════════════════════════════════════════════════════════
  //  ADD A NEW LAYER HERE — copy the block above and modify it
  //  Example:
  //
  // {
  //   id:          "layer2",
  //   title:       "Layer 2",
  //   subtitle:    "Network & SDN Security",
  //   headerLabel: "PhD Research Reference",
  //   description: "...",
  //   attacks: [
  //     {
  //       navTitle: "ARP Spoofing",
  //       navSub:   "...",
  //       badge:    "Pure Layer 2",
  //       badgeStyle: "l1",
  //       title:    "ARP Spoofing",
  //       cve:      "...",
  //       background: { tag: "...", paragraphs: [...], callout: {...} },
  //       mechanism:  { tag: "...", intro: "...", steps: [...], callout: null },
  //       defenses:   { tag: "...", items: [...] },
  //       gaps:       { tag: "...", items: [...], research: "..." },
  //       references: [...],
  //     },
  //   ],
  // },
  // ════════════════════════════════════════════════════════════

]; // end LAYERS
