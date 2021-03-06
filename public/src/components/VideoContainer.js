import React, { Component } from 'react';
import axios from 'axios';
import Video from 'twilio-video';
import AddRoomDialog from './AddRoomDialog';
import {
  AppBar,
  Button,
  Toolbar,
  Drawer,
  Fab,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@material-ui/core';
import Menu from '@material-ui/icons/Menu';
import PhoneInTalk from '@material-ui/icons/PhoneInTalk';
import Cancel from '@material-ui/icons/Cancel';
import VideoCall from '@material-ui/icons/VideoCall';
import Delete from '@material-ui/icons/Delete';

class VideoContainer extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      activeRoom: null,
      previewTracks: null,
      identity: null,
      isDrawerOpened: false,
      selectedRoomIndex: null,
      isRoomDialogOpen: false,
    };

    this.leaveRoomIfJoined = this.leaveRoomIfJoined.bind(this);
    this.roomJoined = this.roomJoined.bind(this);
    this.joinRoom = this.joinRoom.bind(this);
    this.toggleDrawer = this.toggleDrawer.bind(this);
    this.handleAddRoomName = this.handleAddRoomName.bind(this);
    
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
      this.props.showNotification(`${participant.identity} joined the conversation`);
    });

    room.on('trackSubscribed', (track, participant) => {
      const previewContainer = this.remoteRef.current;
      this.attachTracks([track], previewContainer);
    });

    room.on('trackUnsubscribed', (track, participant) => {
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

  leaveRoomIfJoined() {
    const {
      activeRoom,
    } = this.state;

    this.setState({
      selectedRoomIndex: null,
    }, () => {
      this.cameraPreview();
      this.toggleDrawer(false);
      if (activeRoom) {
        activeRoom.disconnect();
      }
    });
  }

  joinRoom() {
    const {
      previewTracks,
      selectedRoomIndex,
    } = this.state;
    const {
      name,
      rooms
    } = this.props;
    
    const room = rooms[selectedRoomIndex];
    
    this.toggleDrawer(false);

    if (!room) {
      alert('Please enter a room name.');
      return;
    }

    const connectOptions = {
      name: room.name,
      ...previewTracks && { tracks: previewTracks },
    };

    axios.get(`/token?identity=${name}`)
      .then(({ data }) => {
        const { token } = data;

        Video
          .connect(token, connectOptions)
          .then(this.roomJoined)
          .catch(error => console.error(error));
      });
  }

  toggleDrawer(open) {
    this.setState({ isDrawerOpened: open });
  }

  handleAddRoomName(name) {
    const room = {
      name,
      isDeletable: true,
    };

    this.setState({
      isRoomDialogOpen: false,
    }, () => this.props.addRoom(room));
  }

  render() {
    const {
      name,
      rooms,
      deleteRoom,
    } = this.props;
    const {
      activeRoom,
      isRoomDialogOpen,
    } = this.state;
    
    const containerClassNames =`
      preview
      ${!name ? 'preview--inactive' : ''}
      ${activeRoom ? 'preview--in-call' : ''}
    `;
    return (
      <div className="video">
        {name && (
          <AppBar position="absolute" className="navbar" >
            <Toolbar>
              <Fab
                color="default"
                onClick={() => this.toggleDrawer(true)}
              >
                <Menu />
              </Fab>
            </Toolbar>
          </AppBar>
        )}

        <div className={containerClassNames}>
          <div className="video-container video-container--local" ref={this.localRef}></div>
          <div className="video-container video-container--remote" ref={this.remoteRef}></div>
        </div>

        <Drawer
          anchor="right"
          open={this.state.isDrawerOpened}
          onClose={() => this.toggleDrawer(false)}
        >
          <div className="sidebar"> 
            <p className="sidebar__header">Room Name:</p>
            <List component="nav">
              <div className="sidebar__channel-list">
                {rooms.map((room, index) => (
                  <ListItem
                    button
                    key={index}
                    selected={this.state.selectedRoomIndex === index}
                    onClick={() => this.setState({ selectedRoomIndex: index })}
                  >
                    <ListItemText primary={room.name} />
                    { room.isDeletable && (
                      <IconButton onClick={() => deleteRoom(index)}>
                        <Delete/>
                      </IconButton>
                    )}
                  </ListItem>
                ))}
              </div>
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="primary"
                onClick={() => this.setState({ isRoomDialogOpen: true })}
              >
                <VideoCall />
                Add Room
              </Button>
            </List>
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="primary"
              onClick={this.joinRoom}
              disabled={this.state.selectedRoomIndex === null}
            >
              <PhoneInTalk />
              Join Room
            </Button>
            {activeRoom && (
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="secondary"
                onClick={this.leaveRoomIfJoined}
              >
                <Cancel />
                Leave Room
              </Button>
            )}
          </div>
        </Drawer>
        <AddRoomDialog
          isOpen={isRoomDialogOpen}
          onSubmit={this.handleAddRoomName}
        />
      </div>
    );
  }
}
  
  export default VideoContainer;