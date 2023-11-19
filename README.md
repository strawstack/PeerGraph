# PeerGraph

Manipulate PeerJS with a Visual NodeGraph.

# Note

- Connections are created in three ways:
    1. The event triggered by NodeGraph.
    2. Another peer connecting for their own reasons.
    3. The host establishing a connection to all peers.
- Every connection must have 'open', 'data', and 'close' actions configured.
    - During these events, NodeGraph can be informed to render different things.
- Every timestep the host should be sending out a heartbeat call.
- Non-host repond to the heartbeat call.
- Non-host switch up the host if nothing heard from the host for timestep.
- The host updates heartbeart data when any data is received.
- When the host receives gamestate, the host sends the update to all peers.
- Multiple "creation" events may be sent to NodeGraph to create the same graphics.
    - Duplicate "creation" or "removal" event should be ignored on the NodeGraph side.

# Todo

