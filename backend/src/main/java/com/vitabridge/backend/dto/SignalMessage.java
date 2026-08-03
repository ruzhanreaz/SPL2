package com.vitabridge.backend.dto;

public class SignalMessage {
    private String type; // "offer", "answer", "ice-candidate", "join", "leave"
    private String from;
    private String to;
    private String roomId;
    private Object data;

    public SignalMessage() {
    }

    public SignalMessage(String type, String from, String to, String roomId, Object data) {
        this.type = type;
        this.from = from;
        this.to = to;
        this.roomId = roomId;
        this.data = data;
    }

    // Getters and Setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }
}
