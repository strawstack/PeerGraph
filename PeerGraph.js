function PeerGraph(createConection) {

    // pid to peer object
    const peer_lookup = {};

    // nid to pid
    const pid_lookup = {};

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
        // TODO: Connection was just opened, save `to` to `heartbeat[from]`
        if (!(from in connection_lookup)) {
            connection_lookup[from] = {};
        }
        connection_lookup[from][to] = conn;
    }

    // Events from NodeGraph
    function create(nid, ref) {
        console.log(`create: ${nid}`);
        const peer = new Peer();
        peer.on('open', function(id) {

            peer_lookup[nid] = {
                ref: ref,
                peer_id: id,
                peer
            };
            heartbeat[id] = {};
            peer.on('connection', (conn) => {
                saveConnection(id, conn.peer, conn);
            });

            const msg = () => {
                // TODO: If no heartbeat peers, do nothing.

                // TODO: If host, establish a connection with all heartbeat peers.
                // Cull heartbeat peers that miss heartbeat check.
                // Send all peers updated heartbeat register (and game state).
                
                // TOOD: If not host, close all connections except for the host.
                // Establish conn with host, and send heartbeat check.
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
        saveLine(from, to, ref);
    }

    return {
        create,
        remove,
        connect
    };
}