function PeerGraph(createConection, removeConection) {

    // pid to peer object
    const peer_lookup = {};

    // nid to pid 
    const pid_lookup = {};

    // pid to nid
    const nid_lookup = {};

    // Line Lookup
    const line_lookup = {};

    // For each peer track all known peers and last time connected
    // {pid -> {pid: last_msg_time, ...}}
    const heartbeat = {};

    // Look up connection between two peers
    // {pid -> {pid: last_msg_time, ...}}
    const connection_lookup = {};

    // Helpers
    function saveLine(from, to, ref) {
        const fid = parseInt(from);
        const tid = parseInt(to);
        if (fid < tid) {
            if (!(fid in line_lookup)) {
                line_lookup[fid] = {};
            }
            line_lookup[fid][tid] = ref;

        } else { // tid < fid
            if (!(tid in line_lookup)) {
                line_lookup[tid] = {};
            }
            line_lookup[tid][fid] = ref;
        }
    }

    function getLine(from, to) {
        const fid = parseInt(from);
        const tid = parseInt(to);
        if (fid < tid) {
            if (!(fid in line_lookup)) {
                return null;
            }
            return line_lookup[fid][tid];

        } else { // tid < fid
            if (!(tid in line_lookup)) {
                return null;
            }
            return line_lookup[tid][fid];
        }
    }

    function saveConnection(from, to, conn) {
        if (!(from in connection_lookup)) {
            connection_lookup[from] = {};
        }
        connection_lookup[from][to] = conn;
        heartbeat[from][to] = Date.now();
    }

    // Events from NodeGraph
    function create(nid, ref) {
        console.log(`create: ${nid}`);
        const peer = new Peer();
        peer.on('open', function(id) {
            nid_lookup[id] = nid;
            peer_lookup[nid] = {
                ref: ref,
                peer_id: id,
                peer
            };
            heartbeat[id] = {};
            peer.on('connection', (conn) => {
                saveConnection(id, conn.peer, conn);
                newconn.on('close', function() {
                    delete connection_lookup[id][conn.peer];
                    removeConection(
                        nid_lookup[id],
                        nid_lookup[conn.peer]
                    );
                });
            });

            const msg = () => {
                // TODO: If no heartbeat peers, do nothing.
                if (numberKnownPeers(id) > 0) {
                    // If host, establish a connection with all heartbeat peers.
                    // TODO: Cull heartbeat peers that miss heartbeat check.
                    // Send all peers updated heartbeat register (and game state).
                    if (isHost(id)) {
                        for (let other_pid in heartbeat[id]) {
                            const conn = connection_lookup[id][other_pid];
                            if (conn === undefined) {
                                const newconn = peer.connect(other_pid);
                                connection_lookup[id][other_pid] = newconn;
                                createConection(
                                    nid_lookup[id],
                                    nid_lookup[other_pid]
                                );
                                newconn.on('open', () => {
                                    saveConnection(id, other_pid, newconn);
                                });
                                newconn.on('data', function(data) {
                                    if (data.type === "heartbeat") {
                                        heartbeat[id][other_pid] = Date.now();
                                    }
                                });
                                newconn.on('close', function() {
                                    delete connection_lookup[id][other_pid];
                                    removeConection(
                                        nid_lookup[id],
                                        nid_lookup[other_pid]
                                    );
                                });
                            } else {
                                if (conn.open) {
                                    conn.send({
                                        type: "heartbeat",
                                        payload: heartbeat[id]
                                    });
                                }
                            }
                        }

                    // If not host, close all connections except for the host.
                    // Establish conn with host, and send heartbeat check.
                    } else {
                        const host_pid = getHost(id);
                        for (let other_pid in heartbeat[id]) {
                            const conn = connection_lookup[id][other_pid];
                            if (host_pid === other_pid) {
                                if (conn === undefined) {
                                    const newconn = peer.connect(host_pid);
                                    connection_lookup[id][host_pid] = newconn;
                                    createConection(
                                        nid_lookup[id],
                                        nid_lookup[host_pid]
                                    );
                                    newconn.on('open', () => {
                                        saveConnection(id, host_pid, newconn);
                                    });
                                    newconn.on('data', function(data) {
                                        if (data.type === "heartbeat") {
                                            const { payload } = data;
                                            // TODO: Merge payload with your heartbeat info
                                            delete payload[id];
                                            for (let h_pid in heartbeat[id]) {
                                                if (!(h_pid in payload)) {
                                                    if (h_pid in connection_lookup[id]) {
                                                        connection_lookup[id][h_pid].close();
                                                    }
                                                }
                                            }
                                            heartbeat[id] = payload;
                                        }
                                    });
                                    newconn.on('close', function() {
                                        delete connection_lookup[id][host_pid];
                                        removeConection(
                                            nid_lookup[id],
                                            nid_lookup[host_pid]
                                        );
                                    });
                                } else {
                                    if (conn.open) {
                                        conn.send({
                                            type: "heartbeat"
                                        });
                                    }
                                }
                            } else {
                                conn.close();
                            }
                        }
                    }
                }
            };
            msg();
            setInterval(msg, 1000);
        });
    }

    function remove(nid) {
        console.log(`remove: ${nid}`);
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
        });
        conn.on('close', function() {
            delete connection_lookup[from_pid][to_pid];
            removeConection(
                nid_lookup[from_pid],
                nid_lookup[to_pid]
            );
        });
        saveLine(from, to, ref);
    }

    return {
        create,
        remove,
        connect
    };
}