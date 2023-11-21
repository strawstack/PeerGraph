function PeerGraph(createConnection, removeConnection) {

    const POLL = 500;
    const CUT  = 600;

    // pid to peer object
    const pid_to_peer_lookup = {};

    // nid to pid 
    const nid_to_pid_lookup = {};

    // For each peer track all known peers and last time connected
    // {pid -> {pid: last_msg_time, ...}}
    const heartbeat = {};

    // Look up connection between two peers
    // {pid -> {pid: last_msg_time, ...}}
    const connection_lookup = {};

    //
    // Helper
    //
    function saveConnection(from, to, conn) {
        if (!(from in connection_lookup)) {
            connection_lookup[from] = {};
        }
        connection_lookup[from][to] = conn;
    }

    function onData(pid, other_pid, conn, data) {
        if (data.type === "heartbeat") {

            heartbeat[pid][other_pid] = Date.now();
            const {payload: heartbeat_data} = data;
            delete heartbeat_data[pid]; // Remove self
            
            if (isHost(pid)) {
                heartbeat[pid] = {...heartbeat_data, ...heartbeat[pid]};

            } else {
                conn.send({
                    type: "heartbeat",
                    payload: heartbeat[pid]
                });
                heartbeat[pid] = {...heartbeat[pid], ...heartbeat_data};
            }

        } else if (data.type === "gamestate_update") {
            if (isHost(pid)) {

            } else {

            }
        }
    }

    function peer_connect(from_pid, to_pid, conn) {
        conn.on('open', () => {
            conn.send({
                type: "heartbeat",
                payload: heartbeat[from_pid]
            });
            saveConnection(from_pid, to_pid, conn);
            heartbeat[from_pid][to_pid] = Date.now();
            createConnection(
                pid_to_peer_lookup[from_pid].nid,
                pid_to_peer_lookup[to_pid].nid
            );
        });
        conn.on('data', (data) => {
            onData(from_pid, to_pid, conn, data);
        });
        conn.on('close', () => {
            console.log(`close: from_pid: ${from_pid}, to_pid: ${to_pid}`);
            delete connection_lookup[from_pid][to_pid];
            delete heartbeat[from_pid][to_pid];
            removeConnection(
                pid_to_peer_lookup[from_pid].nid,
                pid_to_peer_lookup[to_pid].nid
            );
        });
    }

    function filterPeers(host_id, heartbeat_peers, CUT) {
        const remove = [];
        for (let pid in heartbeat_peers) {
            const delta = Date.now() - heartbeat_peers[pid];
            if (CUT <= delta) {
                remove.push(pid);
            }
        }
        for (let pid of remove) {
            const conn = connection_lookup[host_id][pid];
            if (conn != undefined) {
                conn.close(); // Close connection triggers cleanup
            }
        }
    }

    function debugListPeers() {
        const peers = Object.keys(pid_to_peer_lookup);
        peers.sort();
        console.log(`host: ${peers[0]}`);
        peers.shift();
        for (let other of peers) {
            console.log(`  other: ${other}`);
        }
    }

    // Events from NodeGraph
    function create(nid, ref) {
        const peer = new Peer();

        peer.on('open', function(id) {
            heartbeat[id] = {};
            nid_to_pid_lookup[nid] = id;
            pid_to_peer_lookup[id] = {
                ref: ref,
                pid: id,
                nid,
                peer
            };

            console.log(`peer open: \n  nid: ${nid}\n  pid: ${id}`);
            debugListPeers();
            
            peer.on('connection', (conn) => {
                peer_connect(id, conn.peer, conn);
            });

            const msg = () => {

                // If no heartbeat peers, do nothing.
                if (numberKnownPeers(id) > 0) {

                    // If host.
                    if (isHost(id)) {

                        // Cull heartbeat peers that miss heartbeat check.
                        filterPeers(id, heartbeat[id], CUT);

                        // Establish a connection with all heartbeat peers.
                        for (let other_pid in heartbeat[id]) {
                            const conn = connection_lookup[id][other_pid];
                            if (conn === undefined) {
                                const newconn = peer.connect(other_pid);
                                saveConnection(id, other_pid, newconn);
                                peer_connect(id, other_pid, newconn);

                            // Send all peers updated heartbeat register.
                            } else {
                                if (conn.open) {
                                    conn.send({
                                        type: "heartbeat",
                                        payload: heartbeat[id]
                                    });
                                }
                            }
                        }

                    // If not host.
                    } else {
                        let host_pid = getHost(id);
                        
                        // Drop host if nothing heard for awhile
                        const delta = Date.now() - heartbeat[id][host_pid];
                        if (CUT <= delta) {
                            const conn = connection_lookup[id][host_pid];
                            if (conn != undefined) {
                                delete heartbeat[id][host_pid]; // fast removal
                                conn.close();
                            }
                        }

                        host_pid = getHost(id);

                        for (let other_pid in heartbeat[id]) {
                            const conn = connection_lookup[id][other_pid];

                            // Establish conn with host, and send heartbeat check.
                            if (host_pid === other_pid) {
                                if (conn == undefined) {
                                    const newconn = peer.connect(host_pid);
                                    connection_lookup[id][host_pid] = newconn;
                                    peer_connect(id, host_pid, newconn);
                                }

                            // Close all connections except for the host.
                            } else {
                                if (conn != undefined) {
                                    conn.close();
                                }
                            }
                        }
                    }
                }
            };
            msg();
            setInterval(msg, POLL);
        });
    }

    function numberKnownPeers(pid) {
        return Object.keys(heartbeat[pid]).length;
    }

    function isHost(pid) {
        const peers = Object.keys(heartbeat[pid]);
        peers.push(pid); // Add self
        peers.sort();
        const lowest = (peers.length > 0) ? peers[0] : null;
        return pid === lowest;
    }

    function getHost(pid) {
        const peers = Object.keys(heartbeat[pid]);
        peers.sort();
        const lowest = (peers.length > 0) ? peers[0] : null;
        return lowest;
    }

    function connect(from, to, ref) {
        console.log(`connect: from: ${from}, to: ${to}`);
        const from_pid = nid_to_pid_lookup[from];
        const to_pid = nid_to_pid_lookup[to];
        const { peer: from_peer } = pid_to_peer_lookup[from_pid];
        var conn = from_peer.connect(to_pid);
        peer_connect(from_pid, to_pid, conn);
    }

    function remove(nid) {
        console.log(`remove: ${nid}`);
        const pid = nid_to_pid_lookup[nid];
        const { peer } = pid_to_peer_lookup[pid];
        peer.destroy();
    }

    return {
        create,
        remove,
        connect
    };
}