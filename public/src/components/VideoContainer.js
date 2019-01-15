import React, { Component } from 'react';
import axios from 'axios';
import Video from 'twilio-video';

class VideoContainer extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      name: `Tomek${Math.floor(new Date() * Math.random())}`,
      activeRoom: null,
      previewTracks: null,
      identity: null,
    };

    this.leaveRoomIfJoined = this.leaveRoomIfJoined.bind(this);
    this.roomJoined = this.roomJoined.bind(this);
    this.joinRoom = this.joinRoom.bind(this);
    
    this.selectRoomRef = React.createRef();
    this.remoteRef = React.createRef();
    this.localRef = React.createRef(); 
  }
  
  componentDidMount() {    
    window.addEventListener('beforeunload', this.leaveRoomIfJoined);
    this.cameraPreview();
  }

  attachTracks(tracks, container) {
    tracks.forEach(track => container.appendChild(track.attach()));
  }

  attachParticipantTracks(participant, container) {
    const tracks = Array.from(participant.tracks.values());
    this.attachTracks(tracks, container);
  }

  detachTracks(tracks) {
    tracks.forEach((track) => {
      track.detach().forEach((detachedElement) => {
        detachedElement.remove();
      });
    });
  }

  detachParticipantTracks(participant) {
    const tracks = Array.from(participant.tracks.values());
    this.detachTracks(tracks);
  }

  roomJoined(room) {
    const { previewTracks } = this.state;

    this.setState({ activeRoom: room });
  
    const previewContainer = this.localRef.current;
    if (!previewContainer.querySelector('video')) {
      this.attachParticipantTracks(room.localParticipant, previewContainer);
    }

    room.participants.forEach((participant) => {
      const previewContainer = this.remoteRef.current;
      this.attachParticipantTracks(participant, previewContainer);
    });

    room.on('participantConnected', (participant) => {
      console.log(`Joining: ${participant.identity}`);
    });

    room.on('trackAdded', (track, participant) => {
      const previewContainer = this.remoteRef.current;
      this.attachTracks([track], previewContainer);
    });

    room.on('trackRemoved', (track, participant) => {
      this.detachTracks([track]);
    });

    room.on('participantDisconnected', (participant) => {
      this.detachParticipantTracks(participant);
    });

    room.on('disconnected', () => {
      if (previewTracks) {
        previewTracks.forEach((track) => {
          track.stop();
        });
        
        this.setState({ previewTracks: null });
      }
      this.detachParticipantTracks(room.localParticipant);
      room.participants.forEach(this.detachParticipantTracks);
      
      this.setState({ activeRoom: null });
    });
  }

  cameraPreview() {
    const {
      previewTracks,
    } = this.state;

    const localTracksPromise = previewTracks
      ? previewTracks
      : Video.createLocalTracks();

    localTracksPromise.then((tracks) => {
      this.setState({ previewTracks: tracks });
      
      const previewContainer = this.localRef.current;
      if (!previewContainer.querySelector('video')) {
        this.attachTracks(tracks, previewContainer);
      }
    }, error => console.error('Unable to access local media', error));
  };

  log(message) {
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  leaveRoomIfJoined() {
    const {
      activeRoom,
    } = this.state;

    if (activeRoom) {
      activeRoom.disconnect();
    }
  }

  joinRoom() {
    const {
      name,
      previewTracks,
    } = this.state;
    
    const roomName = this.selectRoomRef.current.value;
        
    if (!roomName) {
      alert('Please enter a room name.');
      return;
    }

    const connectOptions = {
      name: roomName,
      logLevel: 'debug',
      ...previewTracks && { tracks: previewTracks },
    };

    axios.get(`/token?identity=${name}`)
      .then(({ data }) => {
        const { token } = data;
        
        Video
          .connect(token, connectOptions)
          .then(this.roomJoined);
      });
  }

  render() {
    return (
      <div id="controls">
        <div id="room-controls">
          <p className="instructions">Room Name:</p>
          <select ref={this.selectRoomRef} placeholder="Select a room">
            <option value="general">General</option>
          </select>
          <button id="button-join"  onClick={this.joinRoom}>Join Room</button>
          <button id="button-leave" onClick={this.leaveRoomIfJoined}>Leave Room</button>
        </div>

        <div className="preview">
          <div className="video-container" ref={this.localRef}></div>
          <div className="video-container" ref={this.remoteRef}></div>
        </div>
        
        <div id="log"></div>
      </div>
    );
  }
}
  
  export default VideoContainer;