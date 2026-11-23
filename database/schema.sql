--
-- PostgreSQL database dump
--

\restrict zEASYopJiFdyT8qEEmdEDD1IhUm9aHm9n1IYjpgX5DaTUNJ4DvNqgnPT4S9M1jY

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: notify_outbox_pending(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_outbox_pending() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'pending'
     AND NEW.next_attempt_at <= NOW()
  THEN
    PERFORM pg_notify(
      'pulseops_outbox',
      NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id bigint NOT NULL,
    monitor_id uuid NOT NULL,
    started_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_incident_duration CHECK (((resolved_at IS NULL) OR (resolved_at >= started_at)))
);


--
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.incidents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.incidents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: monitor_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitor_checks (
    id bigint NOT NULL,
    monitor_id uuid NOT NULL,
    status text NOT NULL,
    status_code integer,
    response_time_ms integer,
    error_message text,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    is_slow boolean,
    threshold_ms_at_check integer,
    CONSTRAINT monitor_checks_response_time_ms_check CHECK ((response_time_ms >= 0)),
    CONSTRAINT monitor_checks_status_check CHECK ((status = ANY (ARRAY['up'::text, 'down'::text])))
);


--
-- Name: monitor_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.monitor_checks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.monitor_checks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: monitor_releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitor_releases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    monitor_id uuid NOT NULL,
    version text NOT NULL,
    deployed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT monitor_releases_version_check CHECK (((length(version) >= 1) AND (length(version) <= 100)))
);


--
-- Name: monitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    response_time_threshold_ms integer DEFAULT 1000 NOT NULL,
    CONSTRAINT monitors_response_time_threshold_ms_check CHECK (((response_time_threshold_ms >= 100) AND (response_time_threshold_ms <= 30000)))
);


--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_outbox (
    id bigint NOT NULL,
    incident_id bigint NOT NULL,
    event_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_until timestamp with time zone,
    claim_token uuid,
    CONSTRAINT notification_outbox_event_type_check CHECK ((event_type = ANY (ARRAY['opened'::text, 'resolved'::text]))),
    CONSTRAINT notification_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: notification_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notification_outbox ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notification_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_heartbeats (
    service_name text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: monitor_checks monitor_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_checks
    ADD CONSTRAINT monitor_checks_pkey PRIMARY KEY (id);


--
-- Name: monitor_releases monitor_releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_releases
    ADD CONSTRAINT monitor_releases_pkey PRIMARY KEY (id);


--
-- Name: monitors monitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitors
    ADD CONSTRAINT monitors_pkey PRIMARY KEY (id);


--
-- Name: monitors monitors_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitors
    ADD CONSTRAINT monitors_url_key UNIQUE (url);


--
-- Name: notification_outbox notification_outbox_incident_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_incident_id_event_type_key UNIQUE (incident_id, event_type);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: service_heartbeats service_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_heartbeats
    ADD CONSTRAINT service_heartbeats_pkey PRIMARY KEY (service_name);


--
-- Name: idx_incidents_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_history ON public.incidents USING btree (monitor_id, started_at DESC);


--
-- Name: idx_monitor_checks_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monitor_checks_history ON public.monitor_checks USING btree (monitor_id, checked_at DESC);


--
-- Name: idx_monitor_releases_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monitor_releases_history ON public.monitor_releases USING btree (monitor_id, deployed_at DESC);


--
-- Name: idx_notification_outbox_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_outbox_pending ON public.notification_outbox USING btree (next_attempt_at, id) WHERE (status = 'pending'::text);


--
-- Name: unique_open_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_open_incident ON public.incidents USING btree (monitor_id) WHERE (resolved_at IS NULL);


--
-- Name: notification_outbox notification_outbox_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notification_outbox_notify AFTER INSERT OR UPDATE OF status, next_attempt_at ON public.notification_outbox FOR EACH ROW EXECUTE FUNCTION public.notify_outbox_pending();


--
-- Name: incidents incidents_monitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_monitor_id_fkey FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE;


--
-- Name: monitor_checks monitor_checks_monitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_checks
    ADD CONSTRAINT monitor_checks_monitor_id_fkey FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE;


--
-- Name: monitor_releases monitor_releases_monitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_releases
    ADD CONSTRAINT monitor_releases_monitor_id_fkey FOREIGN KEY (monitor_id) REFERENCES public.monitors(id) ON DELETE CASCADE;


--
-- Name: notification_outbox notification_outbox_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict zEASYopJiFdyT8qEEmdEDD1IhUm9aHm9n1IYjpgX5DaTUNJ4DvNqgnPT4S9M1jY

