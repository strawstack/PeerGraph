function PeerGraph(createConection, removeConection) {

    const POLL = 1000;
    const CUT  = 3000;

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

    function onData(from_pid, to_pid, conn, data) {
        if (isHost(from_pid)) {
            heartbeat[from_pid][to_pid] = Date.now();
            if (data.type === "gamestate_update") {
                // Update global gamestate and send to all peers

            }
        } else {
            if (data.type === "heartbeat") {
                conn.send({
                    type: "heartbeat"
                });

            } else if (data.type === "gamestate") {
                // Sync local state with gamestate

            }
        }
    }

    function peer_connect(from_pid, to_pid, conn) {
        conn.on('open', () => {
            saveConnection(from_pid, to_pid, conn);
            heartbeat[from_pid][to_pid] = Date.now();
            createConection(
                pid_to_peer_lookup[from_pid].nid,
                pid_to_peer_lookup[to_pid].nid
            );
        });
        conn.on('data', (data) => {
            onData(from_pid, to_pid, conn, data);
        });
        conn.on('close', () => {
            delete connection_lookup[from_pid][to_pid];
            delete heartbeat[from_pid][to_pid];
            removeConection(
                pid_to_peer_lookup[from_pid].nid,
                pid_to_peer_lookup[to_pid].nid
            );
        });        
    }

    function filterPeers(heartbeat_peers, DELTA) {
        const remove = [];
        for (let pid in heartbeat_peers) {
            const time = heartbeat_peers[pid];
            if (DELTA <= time) {
                remove.push(pid);
            }
        }
        for (let pid of remove) {
            delete heartbeat_peers[pid];
        }
        return heartbeat_peers;
    }

    // Events from NodeGraph
    function create(nid, ref) {

        console.log(`create: ${nid}`);
        const peer = new Peer();

        peer.on('open', function(id) {
            heartbeat[id] = {};
            nid_to_pid_lookup[id] = nid;
            pid_to_peer_lookup[id] = {
                ref: ref,
                pid: id,
                nid,
                peer
            };
            
            peer.on('connection', (conn) => {
                peer_connect(id, conn.peer, conn);
            });

            const msg = () => {
                // If no heartbeat peers, do nothing.
                if (numberKnownPeers(id) > 0) {

                    // If host.
                    if (isHost(id)) {

                        // Cull heartbeat peers that miss heartbeat check.
                        heartbeat[id] = filterPeers(heartbeat[id], CUT);

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
                        const host_pid = getHost(id);
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
                                conn.close();
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
        const from_pid = pid_lookup[from];
        const to_pid = pid_lookup[to];
        const from_peer = peer_lookup[from_pid];
        var conn = from_peer.connect(to_pid);
        conn.on('open', () => {
            saveConnection(from_pid, to_pid, conn);
            heartbeat[from_pid][to_pid] = Date.now();
        });
        conn.on('close', function() {
            delete connection_lookup[from_pid][to_pid];
            delete heartbeat[from_pid][to_pid];
            removeConection(
                nid_lookup[from_pid],
                nid_lookup[to_pid]
            );
        });
    }

    function remove(nid) {
        console.log(`remove: ${nid}`);
    }

    return {
        create,
        remove,
        connect
    };
}